/**
 * MitoAge data pipeline, build 2. Run with `bun run data` (bun run pipeline/build.ts).
 *
 * Inputs: the MitoAge build 1 CSV export (data/input), the RefSeq records cited by build 1 (cached
 * efetch copies), and the pinned build 2 sources in data/cache/build2/sources (RefSeq mitochondrion
 * release 237, NCBI Taxonomy, AnAge build 15, FishBase and SeaLifeBase v26.06, USGS BBL v2025.1;
 * EURING when present), optionally Open Tree of Life + TimeTree for a dated tree.
 * Outputs: src/data/generated/{build-info,taxonomy,phylogeny}.json and public/data/ (parquet
 * downloads, changelog, lifespan observations, review list, the frozen build 1 snapshot).
 * Set MITOAGE_SKIP_TREE=1 to skip the phylogeny; MITOAGE_BUILD_DATE (YYYY-MM-DD) dates the build.
 */
import { join } from "node:path";
import type { BuildInfo, GenomeFeature, RecordStatus, Species, Traits } from "../src/data/schema";
import { round } from "./lib/stats";
import { ANAGE_URL, type AnAgeEntry, anageObservations, loadAnAge } from "./sources/anage";
import { loadEuring } from "./sources/euring";
import { loadFishBase } from "./sources/fishbase";
import { loadLegacyIds } from "./sources/legacy";
import { loadMitoAgeCsv } from "./sources/mitoage";
import { NcbiTaxonomy } from "./sources/ncbi-taxonomy";
import { fetchGenBank } from "./sources/ncbi";
import { ANAGE_PINNED, EURING, FISHBASE, NCBI_TAXONOMY, REFSEQ_RELEASE, SEALIFEBASE, USGS_BBL } from "./sources/pinned";
import { loadRefSeqRelease } from "./sources/refseq-release";
import { loadSeaLifeBase } from "./sources/sealifebase";
import { type DatedTree, buildDatedTree } from "./sources/tree";
import { loadUsgsBbl } from "./sources/usgs-bbl";
import { BUILD1_DATE, writeBuild1Snapshot } from "./steps/build1";
import { BUILD, assembleBuild2, fallbackTable } from "./steps/build2";
import { datasetMembers } from "./steps/correlations";
import { type SpeciesGenome, annotateGenome } from "./steps/genome";
import { matchSourceNames, wantedNameKeys } from "./steps/lifespan";
import { PUBLIC_DATA_DIR, writeGenerated, writePublic } from "./steps/output";
import { buildPublicReadme } from "./steps/readme";
import { classifyRelease } from "./steps/refseq";
import { buildCodonUsage, buildRegionStats, computeNonCoding, fixCsvLabels } from "./steps/regions";
import { buildTaxonomyTree, flattenTaxa, uniqueSpeciesSlugs } from "./steps/taxonomy";
import { validateGenerated } from "./validate";

const t0 = Date.now();
const step = (msg: string) => console.log(`\n[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);
const notes: string[] = [];
const BUILD_DATE = `${process.env["MITOAGE_BUILD_DATE"] ?? "2026-11-13"}T00:00:00.000Z`;

/** Records present in the CSV export that the published MitoAge release (922 species) excludes. */
const EXCLUDED: Record<string, string> = {
  "Loxioides bailleui":
    "RefSeq NC_025626.1 is titled 'complete genome' but is only 9,243 bp (about 7 kb short of a complete avian mtDNA)",
};

// ================================================================== build 1 baseline
step("Loading MitoAge build 1 CSV export");
const raw = await loadMitoAgeCsv();
console.log(`  ${raw.files.length} files, ${raw.species.size} distinct HAGRIDs`);

step("Recovering legacy site ids (www.mitoage.info export pages)");
const legacy = await loadLegacyIds();
console.log(legacy ? `  ${legacy.ids.size} species on ${legacy.pages} pages` : "  unavailable, legacyId stays null");

const allRaw = [...raw.species.values()].sort((a, b) => a.hagrid - b.hagrid);
const kept = allRaw.filter((s) => !(s.species in EXCLUDED));
for (const s of allRaw.filter((x) => x.species in EXCLUDED)) {
  notes.push(`The build 1 CSV export has ${allRaw.length} species but the published release has ${kept.length}: ${s.species} (HAGRID ${s.hagrid}, ${s.refseq}) is excluded: ${EXCLUDED[s.species]}.`);
}

step("RefSeq records cited by build 1 (cached efetch copies)");
const { texts: citedTexts, failed } = await fetchGenBank(kept.map((s) => s.refseq));
if (failed.length) throw new Error(`RefSeq records cited by build 1 not available: ${failed.join(", ")}`);
const cited = new Map<number, SpeciesGenome>();
const citedText = new Map<number, string>();
for (const s of kept) {
  const text = citedTexts.get(s.refseq)!;
  const g = annotateGenome(text, fallbackTable(s.phylum), s.phylum === "Chordata");
  if (g.record.accessionVersion !== s.refseq) throw new Error(`Got ${g.record.accessionVersion} for ${s.refseq}`);
  cited.set(s.hagrid, g);
  citedText.set(s.hagrid, text);
}

step(`Loading AnAge (${ANAGE_PINNED.version}, ${ANAGE_URL})`);
const anage = await loadAnAge();
console.log(`  ${anage.build}, released ${anage.releaseDate}, ${anage.entries.length} entries, md5 ${anage.md5}`);
const anageByName = new Map(anage.entries.map((e) => [e.scientificName.toLowerCase(), e]));
const anageByCommon = new Map<string, AnAgeEntry[]>();
for (const e of anage.entries) {
  const k = e.commonName.toLowerCase();
  anageByCommon.set(k, [...(anageByCommon.get(k) ?? []), e]);
}
const anageMatch = new Map<number, { entry: AnAgeEntry | null; how: string }>();
for (const s of kept) {
  const exact = anageByName.get(s.species.toLowerCase());
  if (exact) anageMatch.set(s.hagrid, { entry: exact, how: "scientific name" });
  else {
    const byCommon = anageByCommon.get(s.commonName.toLowerCase()) ?? [];
    anageMatch.set(s.hagrid, byCommon.length === 1 ? { entry: byCommon[0]!, how: "common name" } : { entry: null, how: "none" });
  }
}

step("Build 1 view (CSV values with the base-label fix, gaps filled from the cited records)");
const slugs1 = uniqueSpeciesSlugs(kept.map((s) => ({ id: s.hagrid, scientificName: s.species, refseq: s.refseq })));
const totalRows = raw.composition.get("total_mtDNA")!;
const totalPcRows = raw.composition.get("total_pc")!;
const baseSpecies: Species[] = kept.map((s) => {
  const total = totalRows.get(s.hagrid)?.[0];
  if (!total) throw new Error(`No total_mtDNA row for ${s.species}`);
  const fixed = fixCsvLabels(total);
  const m = anageMatch.get(s.hagrid)!;
  const g = cited.get(s.hagrid)!;
  const nonCoding = totalPcRows.has(s.hagrid) ? total.nonCodingBp : computeNonCoding(g);
  const traits: Traits = m.entry
    ? { ...m.entry.traits, source: `AnAge ${anage.build} (HAGRID ${m.entry.hagrid})` }
    : { adultWeightG: null, birthWeightG: null, metabolicRateW: null, bodyTemperatureK: null, femaleMaturityDays: null, maleMaturityDays: null, gestationDays: null, litterSize: null, littersPerYear: null, growthRatePerDay: null, source: null };
  return {
    id: s.hagrid, slug: slugs1.get(s.hagrid)!, refseq: s.refseq, scientificName: s.species, commonName: s.commonName,
    taxonomy: { kingdom: s.kingdom, phylum: s.phylum, class: s.class, order: s.order, family: s.family, genus: s.genus },
    maxLongevityYears: s.maxLongevityYears, mtdnaSizeBp: total.lengthBp, nonCodingBp: nonCoding,
    gcPercent: round((100 * (fixed.g + fixed.c)) / (fixed.a + fixed.c + fixed.g + fixed.t), 3), traits,
    legacyId: legacy?.ids.get(s.species) ?? null,
  };
});
const baseIds = baseSpecies.map((s) => s.id);
const { stats: baseStats } = buildRegionStats(baseIds, raw, cited);
const tableOf1 = (id: number) => cited.get(id)!.translTable;
const { usage: baseUsage } = buildCodonUsage(baseIds, raw, cited, tableOf1);
const baseFeatures = new Map<number, GenomeFeature[]>();
for (const id of baseIds) baseFeatures.set(id, cited.get(id)!.features.map((f) => ({ name: f.name, type: f.type, start: f.start, end: f.end, strand: f.strand })));

// ================================================================== build 2 sources
step(`RefSeq mitochondrion ${REFSEQ_RELEASE.version}`);
const release = await loadRefSeqRelease();
console.log(`  ${release.headers.length} records, md5 ${release.md5}`);

step(`NCBI Taxonomy (${NCBI_TAXONOMY.version})`);
const tax = await NcbiTaxonomy.load();
const lineageFor = new Set<number>();
for (const h of release.headers) {
  if (h.taxid === null) continue;
  const sp = tax.speciesOf(h.taxid);
  if (sp !== null) lineageFor.add(sp);
}
for (const g of cited.values()) if (g.taxid !== null) lineageFor.add(tax.speciesOf(g.taxid) ?? tax.current(g.taxid));

step("Lifespan sources");
const anageObs = anageObservations(anage);
const fishbase = await loadFishBase();
const sealifebase = await loadSeaLifeBase();
const usgs = await loadUsgsBbl();
const euring = loadEuring();
if (!euring.retrieved) {
  console.warn(`  ${euring.message}`);
  notes.push(euring.message);
}
const observations = [...anageObs, ...fishbase.observations, ...sealifebase.observations, ...euring.observations, ...usgs];
console.log(`  AnAge ${anageObs.length}, FishBase ${fishbase.observations.length}, SeaLifeBase ${sealifebase.observations.length}, USGS BBL ${usgs.length}, EURING ${euring.observations.length} observations`);
const synonyms = new Map([["FishBase", fishbase.synonyms], ["SeaLifeBase", sealifebase.synonyms]]);
const nameTaxids = new Set<number>(lineageFor);
for (const g of cited.values()) if (g.taxid !== null) nameTaxids.add(tax.current(g.taxid));
await tax.loadNames(wantedNameKeys(observations, synonyms), nameTaxids);

step("Matching source names to NCBI species");
const matches = matchSourceNames(observations, tax, synonyms);
{
  const by = new Map<string, number>();
  for (const m of matches.values()) by.set(`${m.source} ${m.status}`, (by.get(`${m.source} ${m.status}`) ?? 0) + 1);
  console.log(`  ${[...by].sort().map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  for (const m of matches.values()) if (m.speciesTaxid !== null) lineageFor.add(m.speciesTaxid);
}
await tax.loadLineages(lineageFor);
const releaseRecords = classifyRelease(release, tax);

step("Assembling build 2");
const b2 = await assembleBuild2({
  raw, kept, base: { species: baseSpecies, stats: baseStats, usage: baseUsage, features: baseFeatures, cited, citedText, anageMatch },
  anage, release, releaseRecords, tax, observations, matches, euringRetrieved: euring.retrieved, buildDate: BUILD_DATE,
  fetchWithParts: async (versions) => {
    const { texts, failed } = await fetchGenBank(versions);
    if (failed.length) throw new Error(`efetch (gbwithparts) failed for ${failed.join(", ")}`);
    return texts;
  },
});
{
  const fetched = b2.report["contigOnlyFetched"] as string[];
  if (fetched.length) {
    notes.push(`${fetched.length} records used from ${REFSEQ_RELEASE.version} carry only a CONTIG line (no sequence) in the release file; their sequence and features were taken from the same accession.version retrieved with NCBI efetch (rettype gbwithparts), checked to have the release's length: ${fetched.join(", ")}.`);
  }
}
const statusCounts: Partial<Record<RecordStatus, number>> = {};
for (const s of b2.species) statusCounts[s.provenance!.recordStatus] = (statusCounts[s.provenance!.recordStatus] ?? 0) + 1;
console.log(`  ${b2.species.length} species ${JSON.stringify(statusCounts)}; ${b2.changelog.length} changelog rows; ${b2.observations.length} lifespan observations; ${b2.review.length} review items; ${JSON.stringify({ ...b2.report, contigOnlyFetched: (b2.report["contigOnlyFetched"] as string[]).length })}`);

// ================================================================== phylogeny and taxonomy
let dated: DatedTree | null = null;
if (process.env["MITOAGE_SKIP_TREE"]) {
  notes.push("Phylogeny skipped (MITOAGE_SKIP_TREE): branch lengths and PIC values are unknown in this build.");
} else {
  step("Dated phylogeny (Open Tree of Life topology + TimeTree node ages)");
  try {
    dated = await buildDatedTree(
      b2.species.map((s) => ({
        id: s.id,
        names: [s.scientificName, ...(s.previousScientificNames ?? [])],
        taxid: b2.taxidOf.get(s.id) ?? null,
      })),
    );
    const st = dated.stats;
    console.log(`  ${JSON.stringify(st)}`);
    const missing = b2.species.length - st.leaves;
    notes.push(
      `Dated tree: topology from the Open Tree of Life synthetic tree (${dated.otlSynthVersion}, induced subtree of ${st.leaves} of ${b2.species.length} species, polytomies kept); node ages from the TimeTree 5 API for ${st.datedByTimeTree} of ${st.internalNodes} internal nodes; ${st.interpolated} undated nodes placed midway between parent and oldest child, ${st.madeMonotone} ages raised to keep parents older than children. ${missing} species are not in the tree: their PIC contribution is unknown (they are left out of PIC, not given values). PIC (Felsenstein 1985) correlations are computed during the site build on this tree.`,
    );
  } catch (e) {
    console.warn(`  phylogeny failed: ${(e as Error).message}`);
    notes.push(`No dated phylogeny in this build (${(e as Error).message}): branch lengths and PIC values are unknown for every species (null), the rest of the build is unaffected.`);
    dated = null;
  }
}
step("Taxonomy tree");
const taxonomy = buildTaxonomyTree(b2.species, dated ? (ids) => dated!.ageOf(ids) : undefined);
console.log(`  ${flattenTaxa(taxonomy).length} taxa above species rank`);

// ================================================================== notes and build info
const count = (f: (s: Species) => boolean) => b2.species.filter(f).length;
notes.push(
  `Build 2 (${BUILD_DATE.slice(0, 10)}): ${b2.species.length} species = ${kept.length} from build 1 + ${count((s) => s.provenance!.recordStatus === "new")} new. Record status: ${Object.entries(statusCounts).map(([k, v]) => `${k} ${v}`).join(", ")}. Every value of a build 1 species that changed is in changelog.parquet with its old value and the reason; build 1 itself is frozen in build1/.`,
  `Genome values (region statistics, codon usage, genome features) of every live species are computed from the RefSeq record in ${REFSEQ_RELEASE.version}; for build 1 species that is the same accession.version they cited (or its newer version, or a live successor when the record was suppressed). Retired species keep their build 1 values.`,
  `Base-label bug of build 1: in every MitoAge CSV file the base columns are complement-labelled ("G" holds C on the RefSeq strand, "C" holds G, "A" holds T, "T" holds A). All a/c/g/t here are on the RefSeq strand as deposited; GC% is unaffected, GC and AT skews change sign relative to the old site.`,
  `Lifespan: AnAge build 15 always first; when AnAge has no value, fish take FishBase v26.06, aquatic invertebrates SeaLifeBase v26.06 and birds EURING (not retrieved) then USGS BBL v2025.1. Every value from every source is in lifespan_observations.parquet. Values from FishBase and SeaLifeBase are CC BY-NC 4.0 (non-commercial).`,
  `Class labels follow the build 1 scheme (AnAge build 12-era: Actinopterygii, Reptilia, ...) for every species, so correlation scopes stay comparable with the 2016 paper; AnAge build 15's fish reclassification (Teleostei, ...) is not adopted.`,
);
const datasets = (["default", "anage_only"] as const).map((d) => ({
  dataset: d,
  filters: "record_status != retired; lifespan_record_type != estimated; lifespan_quality not in (low, questionable)",
  lifespanSources: d === "default" ? ["AnAge", "FishBase", "SeaLifeBase", "USGS_BBL"] : ["AnAge"],
  species: datasetMembers(b2.species, d).length,
}));
const buildInfo: BuildInfo = {
  build: `2 (${BUILD_DATE.slice(0, 10)})`,
  buildNumber: BUILD,
  buildDate: BUILD_DATE,
  generatedAt: BUILD_DATE,
  speciesCount: b2.species.length,
  recordStatusCounts: statusCounts,
  correlationDatasets: datasets,
  sources: [
    { name: "MitoAge build 1", version: `Build 1 (${BUILD1_DATE.slice(0, 10)}), full database CSV export (frozen in public/data/build1/)`, url: "https://www.mitoage.info/", license: "Free for all purposes provided MitoAge is cited (Toren et al. 2016, Nucleic Acids Res 44:D1262-D1265)" },
    ...[REFSEQ_RELEASE, NCBI_TAXONOMY, ANAGE_PINNED, FISHBASE, SEALIFEBASE, USGS_BBL].map((p) => ({ name: p.name, version: `${p.version}; retrieved ${p.retrieved}`, url: p.url, license: p.license })),
    { name: EURING.name, version: euring.retrieved ? EURING.version : `${EURING.version}: NOT RETRIEVED (euring.org in maintenance on ${EURING.retrieved}); no EURING values used`, url: EURING.url, license: EURING.license },
    { name: "NCBI RefSeq records cited by build 1 (E-utilities efetch, cached)", version: `${cited.size} versioned records`, url: "https://www.ncbi.nlm.nih.gov/refseq/", license: REFSEQ_RELEASE.license },
    ...(dated
      ? [
          { name: "Open Tree of Life synthetic tree", version: dated.otlSynthVersion, url: "https://tree.opentreeoflife.org/", license: "CC0 1.0 (Open Tree of Life data); cite Hinchliff et al. 2015, PNAS 112:12764" },
          { name: "TimeTree 5", version: "public API (api.timetree.org)", url: "https://timetree.org/", license: "Free public resource; cite Kumar et al. 2022, Mol Biol Evol 39:msac174" },
        ]
      : []),
  ],
  notes,
};

// ================================================================== write
step("Writing outputs");
const genSizes = await writeGenerated({ buildInfo, taxonomy, phylogeny: dated ? { version: dated.otlSynthVersion, root: dated.root } : null });
const pubSizes = await writePublic(
  { species: b2.species, stats: b2.stats, usage: b2.usage, features: b2.features, observations: b2.observations, changelog: b2.changelog, review: b2.review, extra: b2.extra },
  buildPublicReadme(buildInfo),
);
for (const f of await writeBuild1Snapshot(join(PUBLIC_DATA_DIR, "build1"))) pubSizes[`build1/${f.parquet}`] = f.bytes;
const fmt = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(2)} MB` : `${(n / 1e3).toFixed(1)} kB`);
for (const [k, v] of Object.entries(genSizes)) console.log(`  src/data/generated/${k}  ${fmt(v)}`);
for (const [k, v] of Object.entries(pubSizes)) console.log(`  public/data/${k}  ${fmt(v)}`);

step("Validating");
const problems = await validateGenerated();
if (problems.length) {
  console.error(problems.map((p) => `  FAIL ${p}`).join("\n"));
  process.exit(1);
}
step(`Done: ${b2.species.length} species, ${b2.stats.length} region stats, ${b2.usage.length} codon tables, ${b2.changelog.length} changelog rows`);
