/**
 * MitoAge data pipeline. Run with `bun run data` (bun run pipeline/build.ts).
 *
 * Inputs: MitoAge build 1 CSV export (data/input), AnAge Build 15, NCBI RefSeq records,
 * legacy site ids, and optionally Open Tree of Life + TimeTree for a dated tree.
 * Outputs: src/data/generated/*.json, public/data/*.parquet|csv|json. Downloads are cached
 * in data/cache, so reruns are offline. Set MITOAGE_SKIP_TREE=1 to skip the phylogeny.
 */
import type { BuildInfo, GenomeFeature, Species, Traits } from "../src/data/schema";
import { compileTree } from "./lib/stats";
import { round } from "./lib/stats";
import { ANAGE_LICENSE, ANAGE_URL, type AnAgeEntry, loadAnAge } from "./sources/anage";
import { loadLegacyIds } from "./sources/legacy";
import { loadMitoAgeCsv } from "./sources/mitoage";
import { fetchGenBank } from "./sources/ncbi";
import { type DatedTree, buildDatedTree } from "./sources/tree";
import { computeCorrelations } from "./steps/correlations";
import { buildFeatureDefs, buildFeatureValues } from "./steps/features";
import { type SpeciesGenome, annotateGenome } from "./steps/genome";
import { buildExplorer, writeGenerated, writePublic } from "./steps/output";
import { buildPublicReadme } from "./steps/readme";
import { buildCodonUsage, buildRegionStats, computeNonCoding, fixCsvLabels } from "./steps/regions";
import { buildTaxonomyTree, flattenTaxa, uniqueSpeciesSlugs } from "./steps/taxonomy";
import { validateGenerated } from "./validate";

const t0 = Date.now();
const step = (msg: string) => console.log(`\n[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);
const notes: string[] = [];
const pct = (a: number, b: number) => (b === 0 ? "n/a" : `${((100 * a) / b).toFixed(1)}%`);

/** Records present in the CSV export that the published MitoAge release (922 species) excludes. */
const EXCLUDED: Record<string, string> = {
  "Loxioides bailleui":
    "RefSeq NC_025626.1 is titled 'complete genome' but is only 9,243 bp (about 7 kb short of a complete avian mtDNA)",
};

// ------------------------------------------------------------------ inputs
step("Loading MitoAge build 1 CSV export");
const raw = await loadMitoAgeCsv();
console.log(`  ${raw.files.length} files, ${raw.species.size} distinct HAGRIDs`);

step("Recovering legacy site ids (www.mitoage.info export pages)");
const legacy = await loadLegacyIds();
console.log(legacy ? `  ${legacy.ids.size} species on ${legacy.pages} pages` : "  unavailable, legacyId stays null");

const allRaw = [...raw.species.values()].sort((a, b) => a.hagrid - b.hagrid);
const excluded = allRaw.filter((s) => s.species in EXCLUDED);
const kept = allRaw.filter((s) => !(s.species in EXCLUDED));
for (const s of excluded) {
  const onOldSite = legacy?.ids.has(s.species);
  notes.push(
    `The CSV export has ${allRaw.length} species but the published MitoAge release has ${kept.length}. The extra record is ${s.species} (HAGRID ${s.hagrid}, ${s.refseq}): ${EXCLUDED[s.species]}. It is not a duplicate${legacy ? ` and it is ${onOldSite ? "listed" : "not listed"} on the legacy site, whose total_mtDNA export lists ${legacy.ids.size} species` : ""}. It is excluded from this build.`,
  );
}
if (legacy) {
  const missing = kept.filter((s) => !legacy.ids.has(s.species));
  if (missing.length) notes.push(`${missing.length} species have no legacy site id: ${missing.map((s) => s.species).join(", ")}.`);
}

step("Fetching RefSeq records from NCBI (cached)");
const { texts, failed } = await fetchGenBank(kept.map((s) => s.refseq));
if (failed.length) notes.push(`RefSeq records could not be downloaded for: ${failed.join(", ")}.`);
const fallbackTable = (phylum: string) => (phylum === "Chordata" ? 2 : phylum === "Echinodermata" ? 9 : 5);
const genomes = new Map<number, SpeciesGenome>();
const unrecognised = new Map<string, number>();
for (const s of kept) {
  const text = texts.get(s.refseq);
  if (!text) continue;
  const g = annotateGenome(text, fallbackTable(s.phylum), s.phylum === "Chordata");
  if (g.record.accessionVersion !== s.refseq) throw new Error(`Got ${g.record.accessionVersion} for ${s.refseq}`);
  genomes.set(s.hagrid, g);
  for (const u of g.unrecognised) unrecognised.set(u, (unrecognised.get(u) ?? 0) + 1);
}
console.log(`  ${genomes.size}/${kept.length} records parsed`);

step(`Loading AnAge (${ANAGE_URL})`);
const anage = await loadAnAge();
console.log(`  ${anage.build}, released ${anage.releaseDate}, ${anage.entries.length} entries`);
const anageByName = new Map(anage.entries.map((e) => [e.scientificName.toLowerCase(), e]));
const anageByCommon = new Map<string, AnAgeEntry[]>();
for (const e of anage.entries) {
  const k = e.commonName.toLowerCase();
  anageByCommon.set(k, [...(anageByCommon.get(k) ?? []), e]);
}

// ------------------------------------------------------------------ species
step("Assembling species");
const slugs = uniqueSpeciesSlugs(kept.map((s) => ({ id: s.hagrid, scientificName: s.species, refseq: s.refseq })));
const anageMatch = new Map<number, { entry: AnAgeEntry | null; how: string }>();
const renamed: string[] = [];
for (const s of kept) {
  const exact = anageByName.get(s.species.toLowerCase());
  if (exact) {
    anageMatch.set(s.hagrid, { entry: exact, how: "scientific name" });
    continue;
  }
  const byCommon = anageByCommon.get(s.commonName.toLowerCase()) ?? [];
  if (byCommon.length === 1) {
    anageMatch.set(s.hagrid, { entry: byCommon[0]!, how: "common name" });
    renamed.push(`${s.species} -> ${byCommon[0]!.scientificName}`);
  } else {
    anageMatch.set(s.hagrid, { entry: null, how: "none" });
  }
}
const totalRows = raw.composition.get("total_mtDNA")!;
const totalPcRows = raw.composition.get("total_pc")!;
const species: Species[] = kept.map((s) => {
  const total = totalRows.get(s.hagrid)?.[0];
  if (!total) throw new Error(`No total_mtDNA row for ${s.species}`);
  const fixed = fixCsvLabels(total);
  const m = anageMatch.get(s.hagrid)!;
  const g = genomes.get(s.hagrid);
  let nonCoding = total.nonCodingBp;
  // Without protein-coding rows the CSV non-coding length counts the whole unannotated genome.
  if (!totalPcRows.has(s.hagrid) && g) nonCoding = computeNonCoding(g);
  const traits: Traits = m.entry
    ? { ...m.entry.traits, source: `AnAge ${anage.build} (HAGRID ${m.entry.hagrid})` }
    : {
        adultWeightG: null, birthWeightG: null, metabolicRateW: null, bodyTemperatureK: null,
        femaleMaturityDays: null, maleMaturityDays: null, gestationDays: null, litterSize: null,
        littersPerYear: null, growthRatePerDay: null, source: null,
      };
  return {
    id: s.hagrid,
    slug: slugs.get(s.hagrid)!,
    refseq: s.refseq,
    scientificName: s.species,
    commonName: s.commonName,
    taxonomy: { kingdom: s.kingdom, phylum: s.phylum, class: s.class, order: s.order, family: s.family, genus: s.genus },
    maxLongevityYears: s.maxLongevityYears,
    mtdnaSizeBp: total.lengthBp,
    nonCodingBp: nonCoding,
    gcPercent: round((100 * (fixed.g + fixed.c)) / (fixed.a + fixed.c + fixed.g + fixed.t), 3),
    traits,
    legacyId: legacy?.ids.get(s.species) ?? null,
  };
});
const speciesIds = species.map((s) => s.id);
const nMatched = [...anageMatch.values()].filter((m) => m.entry).length;
const lonDiff = species.filter((s) => {
  const e = anageMatch.get(s.id)?.entry;
  return e && e.maxLongevityYears !== null && e.maxLongevityYears !== s.maxLongevityYears;
}).length;
notes.push(
  `AnAge ${anage.build} renumbered HAGRIDs, so traits are joined on scientific name, not HAGRID: ${nMatched - renamed.length} species match by scientific name and ${renamed.length} by a unique common-name match after taxonomic renaming (${renamed.join("; ")}); ${species.length - nMatched} unmatched. Species ids remain the MitoAge (AnAge build 12-era) HAGRIDs; the current AnAge HAGRID is given in traits.source.`,
);
notes.push(
  `maxLongevityYears is the MitoAge build 1 value (as in the 2016 paper). For ${lonDiff} species AnAge ${anage.build} now gives a different maximum longevity; the current value is in the downloads (anage_build15_max_longevity_years).`,
);

// ------------------------------------------------------------------ composition
step("Region base composition (CSV with label fix, checked against RefSeq)");
const { stats, report } = buildRegionStats(speciesIds, raw, genomes);
const human = species.find((s) => s.scientificName === "Homo sapiens");
if (human) {
  const hRow = totalRows.get(human.id)![0]!;
  const hFix = stats.find((s) => s.speciesId === human.id && s.region === "total_mtDNA")!;
  notes.push(
    `Base-label bug: in every MitoAge CSV file the base columns are complement-labelled. The column "G" holds the number of C on the RefSeq strand, "C" holds G, "A" holds T and "T" holds A. Example: Homo sapiens ${human.refseq} has G=${hRow.labelG}, C=${hRow.labelC}, A=${hRow.labelA}, T=${hRow.labelT} in the CSV, while the deposited sequence (rCRS) has A=${hFix.a}, C=${hFix.c}, G=${hFix.g}, T=${hFix.t}. The same complement relation holds for total_mtDNA in all ${report.agreement["total_mtDNA"]?.exact ?? 0} of ${report.agreement["total_mtDNA"]?.compared ?? 0} species and for every gene and aggregate file on the RefSeq (+) strand, including minus-strand genes such as ND6 (it is not a gene-sense or strand effect: the original pipeline counted the complementary strand). All RegionStats a/c/g/t here are corrected to the RefSeq strand as deposited; GC% is unaffected, GC and AT skews change sign relative to the old site. Codon counts were verified separately and are correctly labelled (gene sense).`,
  );
}
const agreeParts: string[] = [];
let agreeTotal = 0;
let comparedTotal = 0;
let asLabelledTotal = 0;
for (const [region, a] of Object.entries(report.agreement)) {
  agreeParts.push(`${region} ${a.exact}/${a.compared}`);
  agreeTotal += a.exact;
  comparedTotal += a.compared;
  asLabelledTotal += a.asLabelled;
}
notes.push(
  `Recomputing every region from the RefSeq sequence and current annotation reproduces the label-fixed CSV counts exactly for ${agreeTotal}/${comparedTotal} species-region pairs (${pct(agreeTotal, comparedTotal)}); with the original labels only ${asLabelledTotal} match. Per region: ${agreeParts.join(", ")}. Mismatches are annotation updates in RefSeq since 2015 (typically CDS ends moved by 1-3 bp around incomplete stop codons, or frameshifted ND3 split into joined segments). CSV values are kept where present.`,
);
const filled = Object.entries(report.filledFromGenBank);
if (filled.length) {
  notes.push(
    `Regions missing from the CSV export but annotated in the current RefSeq record were computed from the sequence (RegionStats.source = "genbank"): ${filled.map(([r, n]) => `${r} ${n}`).join(", ")}. D-loop values include misc_feature "control region" annotations when a record has no D-loop feature.`,
  );
}
if (report.duplicateRowsResolved.length) {
  notes.push(`Duplicate CSV rows resolved: ${report.duplicateRowsResolved.join("; ")}.`);
}
const noPc = kept.filter((s) => !totalPcRows.has(s.hagrid)).map((s) => s.species);
if (noPc.length) {
  notes.push(
    `${noPc.length} species had no gene-level rows in the CSV export because their RefSeq records were unannotated in 2015 (${noPc.join(", ")}); their gene statistics, codon usage and non-coding length come from the current RefSeq annotation.`,
  );
}

step("Codon usage");
const tableOf = (id: number) => genomes.get(id)?.translTable ?? fallbackTable(raw.species.get(id)!.phylum);
const { usage, report: codonReport } = buildCodonUsage(speciesIds, raw, genomes, tableOf);
{
  let ex = 0;
  let cmp = 0;
  for (const a of Object.values(codonReport.agreement)) {
    ex += a.exact;
    cmp += a.compared;
  }
  const tp = codonReport.totalPcEqualsGeneSum;
  notes.push(
    `Codon counts in the CSV are correctly labelled (gene sense, RNA alphabet): recounting codons from the RefSeq CDS features reproduces ${ex}/${cmp} gene rows exactly (${pct(ex, cmp)}); the rest differ only where CDS coordinates were re-annotated. total_pc equals the sum of the 13 genes in ${tp.equal}/${tp.compared} species. Amino-acid counts use the NCBI genetic code given in each record (/transl_table: 2 vertebrate, 5 invertebrate, 9 echinoderm mitochondrial); AGA/AGG count as stops under table 2.`,
  );
}

step("Genome features");
const features = new Map<number, GenomeFeature[]>();
const viaCounts = new Map<string, number>();
for (const id of speciesIds) {
  const g = genomes.get(id);
  if (!g) continue;
  features.set(
    id,
    g.features.map((f) => ({ name: f.name, type: f.type, start: f.start, end: f.end, strand: f.strand })),
  );
  for (const f of g.features) if (f.via) viaCounts.set(f.via, (viaCounts.get(f.via) ?? 0) + 1);
}
{
  const complete = [...features.values()].filter((fs) => {
    const n = (t: string) => fs.filter((f) => f.type === t).length;
    return n("CDS") >= 13 && n("rRNA") >= 2 && n("tRNA") >= 22;
  }).length;
  const unresolved = viaCounts.get("unresolved") ?? 0;
  notes.push(
    `Genome features come from the RefSeq feature tables (${features.size} species; ${complete} with at least 13 CDS, 2 rRNA and 22 tRNA). Names are normalised across synonyms (COI/COX1/CO1, ATPase6, cob/CYTB, s-rRNA/rrnS/12S, trnF/tRNA-Phe ...). The two leucine and two serine tRNAs are named by codon family (tRNA-Leu(UUR), tRNA-Leu(CUN), tRNA-Ser(UCN), tRNA-Ser(AGY)) from the /anticodon qualifier (${viaCounts.get("anticodon") ?? 0}), "codons recognized" notes (${viaCounts.get("codons") ?? 0}), product text (${viaCounts.get("name") ?? 0}), HGNC-style numbering TRNL1/TRNL2 (${viaCounts.get("numbering") ?? 0}) or conserved gene order (Leu(UUR) after 16S, Ser(UCN) after COX1: ${(viaCounts.get("position") ?? 0) + (viaCounts.get("complement") ?? 0)})${unresolved ? `; ${unresolved} remain plain tRNA-Leu/tRNA-Ser` : ""}. Coordinates are 1-based inclusive; start > end marks a feature spanning the origin.${unrecognised.size ? ` Unrecognised feature names: ${[...unrecognised].map(([k, v]) => `${k} (${v})`).join(", ")}.` : ""}`,
  );
}

// ------------------------------------------------------------------ features
step("Feature definitions and values");
const defs = buildFeatureDefs();
const nonCodingMap = new Map(species.map((s) => [s.id, s.nonCodingBp]));
const values = buildFeatureValues(defs, speciesIds, stats, usage, nonCodingMap);
console.log(`  ${defs.length} features`);

// ------------------------------------------------------------------ phylogeny
let dated: DatedTree | null = null;
if (process.env["MITOAGE_SKIP_TREE"]) {
  notes.push("Phylogeny skipped (MITOAGE_SKIP_TREE): branch lengths and PIC are not available in this build.");
} else {
  step("Dated phylogeny (Open Tree of Life topology + TimeTree node ages)");
  try {
    dated = await buildDatedTree(
      kept.map((s) => {
        const alt = anageMatch.get(s.hagrid)?.entry?.scientificName;
        return {
          id: s.hagrid,
          names: alt && alt !== s.species ? [s.species, alt] : [s.species],
          taxid: genomes.get(s.hagrid)?.taxid ?? null,
        };
      }),
    );
    const st = dated.stats;
    console.log(`  ${JSON.stringify(st)}`);
    notes.push(
      `Dated tree: topology from the Open Tree of Life synthetic tree (${dated.otlSynthVersion}, induced subtree of ${st.leaves} of ${species.length} species, polytomies kept); node ages from the TimeTree 5 API (MRCA age of representative descendants by NCBI taxon id) for ${st.datedByTimeTree} of ${st.internalNodes} internal nodes; ${st.interpolated} undated nodes were placed midway between parent and oldest child and ${st.madeMonotone} ages were raised to keep parents older than children. Root age ${st.rootAge.toFixed(0)} Mya. Taxonomy branchLengthMya is the difference between the crown ages (MRCA in this tree) of a taxon and its parent within this species set. PIC (Felsenstein 1985) correlations use this tree; polytomies are resolved with zero-length branches.`,
    );
  } catch (e) {
    console.warn(`  phylogeny failed: ${(e as Error).message}`);
    notes.push(`No dated phylogeny in this build (${(e as Error).message}); branchLengthMya is undefined and picR/picPValue are null.`);
    dated = null;
  }
}

step("Taxonomy tree");
const taxonomy = buildTaxonomyTree(species, dated ? (ids) => dated!.ageOf(ids) : undefined);
console.log(`  ${flattenTaxa(taxonomy).length} taxa above species rank`);

// ------------------------------------------------------------------ correlations
step("Correlations");
const indexOf = new Map(speciesIds.map((id, i) => [id, i]));
const compiled = dated ? compileTree(dated.root, (leaf) => indexOf.get(leaf)) : null;
const { rows: correlations, scopes } = computeCorrelations(species, defs, values, compiled);
console.log(`  ${correlations.length} rows in ${scopes.length} scopes`);
notes.push(
  `Correlations: Pearson r and Spearman rho between each feature and the log10-transformed trait, two-tailed p from the t distribution, Benjamini-Hochberg q within each (trait, scope). Scopes: all species, classes and orders with at least 20 species (${scopes.length} scopes); per-gene codon and amino-acid features are tested in "all" and class scopes only. Rows need at least 10 species with both values. For maxLongevityYears, partialR is the partial correlation with log10 lifespan controlling for log10 adult weight (AnAge).`,
);

// ------------------------------------------------------------------ write
step("Writing outputs");
const today = process.env["SOURCE_DATE_EPOCH"]
  ? new Date(Number(process.env["SOURCE_DATE_EPOCH"]) * 1000).toISOString()
  : `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
const buildInfo: BuildInfo = {
  build: `2.0 (${today.slice(0, 10)})`,
  generatedAt: today,
  speciesCount: species.length,
  sources: [
    {
      name: "MitoAge build 1",
      version: "Build 1 (July 1, 2015), full database CSV export",
      url: "https://www.mitoage.info/",
      license: "Free for all purposes provided MitoAge is cited (Toren et al. 2016, Nucleic Acids Res 44:D1262-D1265)",
    },
    { name: "AnAge", version: `${anage.build} (released ${anage.releaseDate})`, url: ANAGE_URL, license: ANAGE_LICENSE },
    {
      name: "NCBI RefSeq (E-utilities efetch)",
      version: `${genomes.size} versioned mitochondrial RefSeq records, retrieved ${today.slice(0, 10)} or earlier (cached)`,
      url: "https://www.ncbi.nlm.nih.gov/refseq/",
      license: "NCBI molecular data are free of use restrictions (NCBI website and data usage policies)",
    },
    ...(dated
      ? [
          {
            name: "Open Tree of Life synthetic tree",
            version: dated.otlSynthVersion,
            url: "https://tree.opentreeoflife.org/",
            license: "CC0 1.0 (Open Tree of Life data); cite Hinchliff et al. 2015, PNAS 112:12764",
          },
          {
            name: "TimeTree 5",
            version: "public API (api.timetree.org)",
            url: "https://timetree.org/",
            license: "Free public resource; cite Kumar et al. 2022, Mol Biol Evol 39:msac174",
          },
        ]
      : []),
  ],
  notes,
};

const payload = {
  buildInfo,
  species,
  taxonomy,
  stats,
  usage,
  features,
  defs,
  values,
  speciesIds,
  correlations,
};
const genSizes = await writeGenerated(payload);
const extra = new Map(
  species.map((s) => {
    const m = anageMatch.get(s.id)!;
    return [
      s.id,
      {
        anageHagrid: m.entry?.hagrid ?? null,
        anageMatch: m.how,
        anageMaxLongevityYears: m.entry?.maxLongevityYears ?? null,
        ncbiTaxid: genomes.get(s.id)?.taxid ?? null,
        translTable: tableOf(s.id),
      },
    ];
  }),
);
const explorer = buildExplorer(species, defs, values, buildInfo);
const pubSizes = await writePublic(payload, { extra }, explorer, buildPublicReadme(buildInfo));
const fmt = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(2)} MB` : `${(n / 1e3).toFixed(1)} kB`);
for (const [k, v] of Object.entries(genSizes)) console.log(`  src/data/generated/${k}  ${fmt(v)}`);
for (const [k, v] of Object.entries(pubSizes)) console.log(`  public/data/${k}  ${fmt(v)}`);

step("Validating");
const problems = await validateGenerated();
if (problems.length) {
  console.error(problems.map((p) => `  FAIL ${p}`).join("\n"));
  process.exit(1);
}
step(`Done: ${species.length} species, ${stats.length} region stats, ${usage.length} codon tables, ${correlations.length} correlations`);
