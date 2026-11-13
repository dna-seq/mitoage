/**
 * MitoAge build 2: re-verifies the build 1 species against the pinned upstream releases, adds new
 * species (complete RefSeq mitogenome + a lifespan from a curated, maintained source), and records
 * every change in the changelog with row-level provenance (plans/DATA_BUILD2_DECISIONS.md).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  PROTEIN_GENES,
  type ChangelogEntry,
  type CodonUsage,
  type GenomeFeature,
  type LifespanInfo,
  type LifespanObservation,
  type RecordStatus,
  type Region,
  type RegionStats,
  type RowProvenance,
  type Species,
  type Traits,
} from "../../src/data/schema";
import { CACHE_DIR } from "../lib/cache";
import { CODONS, aminoAcidCounts } from "../lib/genetic-code";
import { round } from "../lib/stats";
import type { AnAge, AnAgeEntry } from "../sources/anage";
import type { NcbiTaxonomy } from "../sources/ncbi-taxonomy";
import type { SourceObservation } from "../sources/observation";
import { ANAGE_PINNED, REFSEQ_RELEASE } from "../sources/pinned";
import type { RawData, RawSpecies } from "../sources/mitoage";
import type { RefSeqRelease } from "../sources/refseq-release";
import { BUILD1_DATE } from "./build1";
import { type AccessionChange, type Classification, type RowChange, diffGenome, featureKeys } from "./diff";
import { type SpeciesGenome, annotateGenome } from "./genome";
import {
  type MatchedObservation,
  type NameMatch,
  type TaxonGroup,
  chooseLifespan,
  harmonisedClass,
  recKey,
  taxonGroup,
  usable,
} from "./lifespan";
import { REGIONS, computeGeneCodons, computeNonCoding, computeRegion, makeStats } from "./regions";
import { type ReleaseRecord, type SpeciesChoice, onePerSpecies, successorFor } from "./refseq";
import { slugify } from "./taxonomy";

export const BUILD = 2;
export const NEW_ID_OFFSET = 10_000_000;
export const mintId = (taxid: number) => NEW_ID_OFFSET + taxid;

export type Usage = CodonUsage & { source: "mitoage" | "genbank"; translTable: number };

/**
 * Possible duplicate species found in the build 2 audit; kept and flagged (owner default h).
 * Each pair names the two scientific names as they appear in build 2.
 */
export const POSSIBLE_DUPLICATES: [string, string, string][] = [
  ["Gadus ogac", "Gadus macrocephalus", "FishBase treats these NCBI species as one (Gadus macrocephalus); each has its own RefSeq mitogenome"],
  ["Panopea generosa", "Panopea abrupta", "both 168 y (AnAge vs SeaLifeBase); P. abrupta is widely treated as a synonym of P. generosa"],
  ["Euthynnus affinis", "Euthynnus alletteratus", "same genus, same maximum longevity (10 y) and the same AnAge common name"],
];

export const fallbackTable = (phylum: string) => (phylum === "Chordata" ? 2 : phylum === "Echinodermata" ? 9 : 5);

export interface ReviewItem {
  reviewType: string;
  ncbiTaxid: number | null;
  scientificName: string | null;
  refseq: string | null;
  source: string | null;
  sourceName: string | null;
  detail: string;
}

export interface Build1Baseline {
  species: Species[];
  stats: RegionStats[];
  usage: Usage[];
  features: Map<number, GenomeFeature[]>;
  /** Genomes of the records cited in build 1 (cached efetch copies). */
  cited: Map<number, SpeciesGenome>;
  citedText: Map<number, string>;
  anageMatch: Map<number, { entry: AnAgeEntry | null; how: string }>;
}

export interface Build2Inputs {
  raw: RawData;
  kept: RawSpecies[];
  base: Build1Baseline;
  anage: AnAge;
  release: RefSeqRelease;
  releaseRecords: ReleaseRecord[];
  tax: NcbiTaxonomy;
  observations: SourceObservation[];
  matches: Map<string, NameMatch>;
  euringRetrieved: boolean;
  buildDate: string;
  /**
   * Full GenBank text (with sequence) of the given accession.versions, for release records that carry
   * only a CONTIG line. Must return the same versions; a missing one stops the build.
   */
  fetchWithParts: (versions: string[]) => Promise<Map<string, string>>;
}

export interface Build2 {
  species: Species[];
  stats: RegionStats[];
  usage: Usage[];
  features: Map<number, GenomeFeature[]>;
  observations: LifespanObservation[];
  changelog: ChangelogEntry[];
  review: ReviewItem[];
  /** Per species: genome used (for the phylogeny's NCBI taxid). */
  taxidOf: Map<number, number | null>;
  extra: Map<number, { anageHagrid: string | null; anageMatch: string; anageMaxLongevityYears: number | null; ncbiTaxid: number | null; translTable: number }>;
  report: Record<string, unknown>;
}

const RENAME_CLASSES = new Set(["genus_transfer", "epithet_spelling_or_gender", "genus_transfer_with_epithet_agreement"]);

/** How a later name relates to a build 1 name. */
export function nameChange(b1: string, now: string | null | undefined): string | null {
  if (!now || b1 === now) return null;
  const [g1, e1] = b1.split(" ");
  const [g2, e2] = now.split(" ");
  if (g1 === g2 && e1 === e2) return null; // same binomial (e.g. a trinomial on one side)
  const sim = (e1 ?? "").slice(0, 4) === (e2 ?? "").slice(0, 4);
  if (g1 !== g2 && e1 === e2) return "genus_transfer";
  if (g1 === g2 && sim) return "epithet_spelling_or_gender";
  if (g1 !== g2 && sim) return "genus_transfer_with_epithet_agreement";
  return "different_species_name";
}

const emptyTraits = (): Traits => ({
  adultWeightG: null, birthWeightG: null, metabolicRateW: null, bodyTemperatureK: null, femaleMaturityDays: null,
  maleMaturityDays: null, gestationDays: null, litterSize: null, littersPerYear: null, growthRatePerDay: null, source: null,
});

/** Region stats, codon usage, features and non-coding length of one genome (build 2 rules). */
export function genomeRows(id: number, g: SpeciesGenome): { stats: RegionStats[]; usage: Usage[]; features: GenomeFeature[]; nonCoding: number } {
  const stats: RegionStats[] = [];
  for (const region of REGIONS) {
    const c = computeRegion(g, region);
    if (c) stats.push(makeStats(id, region, c.counts, "genbank"));
  }
  const usage: Usage[] = [];
  const parts: Record<string, number>[] = [];
  for (const gene of PROTEIN_GENES) {
    const counts = computeGeneCodons(g, gene);
    if (!counts) continue;
    parts.push(counts);
    usage.push({ speciesId: id, region: gene, counts, aminoAcids: aminoAcidCounts(counts, g.translTable), source: "genbank", translTable: g.translTable });
  }
  if (parts.length) {
    const counts: Record<string, number> = {};
    for (const c of CODONS) counts[c] = parts.reduce((s, x) => s + (x[c] ?? 0), 0);
    usage.push({ speciesId: id, region: "total_pc", counts, aminoAcids: aminoAcidCounts(counts, g.translTable), source: "genbank", translTable: g.translTable });
  }
  const features = g.features.map((f) => ({ name: f.name, type: f.type, start: f.start, end: f.end, strand: f.strand }));
  return { stats, usage, features, nonCoding: computeNonCoding(g) };
}

/** Accession of the source INSDC record named in a RefSeq COMMENT ("derived from X"). */
export function primaryAccession(text: string): string | null {
  const m = /\nCOMMENT(.*?)\nFEATURES/s.exec(text);
  const c = m ? m[1]!.replace(/\s+/g, " ") : "";
  return /(?:identical to|derived from)\s+([A-Z]{1,2}_?\d+(?:\.\d+)?)/.exec(c)?.[1] ?? null;
}

const PRIMARY_DIR = join(CACHE_DIR, "build2", "genbank_primary");
export function primaryText(acc: string): { accession: string; text: string } | null {
  if (!existsSync(PRIMARY_DIR)) return null;
  const files = readdirSync(PRIMARY_DIR).filter((f) => f.endsWith(".gb") && (f === `${acc}.gb` || f.startsWith(`${acc}.`)));
  if (files.length !== 1) return null;
  return { accession: files[0]!.slice(0, -3), text: readFileSync(join(PRIMARY_DIR, files[0]!), "utf8") };
}

const FISH_CLASSES = new Set(["Actinopterygii", "Chondrichthyes", "Myxini", "Sarcopterygii", "Cephalaspidomorphi"]);
/** Taxon group of a build 1 species from its build 1 classification. */
export function groupOfBuild1(s: { phylum: string; class: string }): TaxonGroup {
  if (s.class === "Aves") return "bird";
  if (FISH_CLASSES.has(s.class)) return "fish";
  if (s.phylum !== "Chordata") return "invertebrate";
  return "other_vertebrate";
}

const lifespanOf = (o: SourceObservation): LifespanInfo => ({
  source: o.source,
  sourceVersion: o.sourceVersion,
  sourceRecordId: o.sourceRecordId,
  quality: o.quality,
  sampleSize: o.source === "AnAge" ? o.sampleSizeText : null,
  recordType: o.recordType,
  license: o.license,
});

const BUILD1_LICENSE = "Free for all purposes provided MitoAge is cited (Toren et al. 2016, Nucleic Acids Res 44:D1262-D1265)";

export async function assembleBuild2(inp: Build2Inputs): Promise<Build2> {
  const { raw, kept, base, release, tax, buildDate } = inp;
  const changelog: ChangelogEntry[] = [];
  const review: ReviewItem[] = [];
  const RS = `NCBI RefSeq ${REFSEQ_RELEASE.version}`;
  const log = (c: RowChange, upstreamSource: string, upstreamVersion: string) =>
    changelog.push({
      build: BUILD, changedAt: buildDate, table: c.table, rowKey: c.rowKey, field: c.field, oldValue: c.oldValue, newValue: c.newValue,
      changeType: c.changeType, diffClass: c.diffClass, reason: c.reason, upstreamSource, upstreamVersion, scope: c.scope,
    });
  const sp = (id: number, field: string, oldValue: unknown, newValue: unknown, c: Classification, src: string, ver: string) =>
    log({ table: "species", rowKey: String(id), field, oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue), newValue: newValue === null || newValue === undefined ? null : String(newValue), ...c }, src, ver);

  // -------------------------------------------------------------- matched observations
  const byTaxid = new Map<number, MatchedObservation[]>();
  for (const o of inp.observations) {
    const m = inp.matches.get(recKey(o.source, o.sourceName, o.speccode));
    if (!usable(m)) continue;
    const mo: MatchedObservation = { ...o, speciesTaxid: m!.speciesTaxid!, matchMethod: m!.method };
    (byTaxid.get(mo.speciesTaxid) ?? byTaxid.set(mo.speciesTaxid, []).get(mo.speciesTaxid)!).push(mo);
  }
  const choice: Map<number, SpeciesChoice> = onePerSpecies(inp.releaseRecords);
  const recordByAccession = new Map(inp.releaseRecords.map((r) => [r.header.accession, r]));

  // -------------------------------------------------------------- originals: identity
  interface Orig {
    s: RawSpecies;
    id: number;
    g1: SpeciesGenome;
    recTaxid: number | null;
    spTaxid: number | null;
    eff: number | null;
    entry: AnAgeEntry | null;
    anageTaxid: number | null;
  }
  const origs: Orig[] = kept.map((s) => {
    const g1 = base.cited.get(s.hagrid);
    if (!g1) throw new Error(`no cached cited record for ${s.species} ${s.refseq}`);
    const recTaxid = g1.taxid === null ? null : tax.current(g1.taxid);
    const spTaxid = recTaxid === null ? null : tax.speciesOf(recTaxid);
    const entry = base.anageMatch.get(s.hagrid)?.entry ?? null;
    const anageTaxid = entry ? (inp.matches.get(recKey("AnAge", entry.scientificName, null))?.speciesTaxid ?? null) : null;
    return { s, id: s.hagrid, g1, recTaxid, spTaxid, eff: spTaxid, entry, anageTaxid };
  });
  // Two build 1 rows on one NCBI species: the row whose AnAge name names another species takes that species.
  const spCount = new Map<number, number>();
  for (const o of origs) if (o.spTaxid !== null) spCount.set(o.spTaxid, (spCount.get(o.spTaxid) ?? 0) + 1);
  for (const o of origs) {
    if (o.spTaxid !== null && spCount.get(o.spTaxid)! > 1 && o.anageTaxid !== null && o.anageTaxid !== o.spTaxid) {
      review.push({
        reviewType: "build1_taxid_conflict", ncbiTaxid: o.anageTaxid, scientificName: o.s.species, refseq: o.s.refseq, source: "MitoAge_build1", sourceName: o.s.species,
        detail: `Build 1 record taxid ${o.recTaxid} (species ${o.spTaxid}) is shared with another build 1 row; the AnAge name match gives species taxid ${o.anageTaxid}, used as this row's species.`,
      });
      o.eff = o.anageTaxid;
    }
  }
  const effSeen = new Set<number>();
  for (const o of origs) {
    if (o.eff === null) throw new Error(`${o.s.species}: no NCBI species for the cited record`);
    if (effSeen.has(o.eff)) throw new Error(`two build 1 species resolve to NCBI species ${o.eff}`);
    effSeen.add(o.eff);
  }
  const origTaxa = new Set<number>();
  for (const o of origs) {
    for (const t of [o.spTaxid, o.eff, o.anageTaxid, recordByAccession.get(o.s.refseq.split(".")[0]!)?.speciesTaxid ?? null]) if (t !== null) origTaxa.add(t);
  }
  const origHagrids = new Set(origs.map((o) => o.entry?.hagrid).filter((h): h is string => !!h));
  const origSpecies = new Set(origs.map((o) => o.spTaxid));
  for (const t of [...choice.keys()].filter((t) => origTaxa.has(t) && !origSpecies.has(t))) {
    const o = origs.find((x) => x.anageTaxid === t || x.eff === t);
    review.push({
      reviewType: "refseq_species_excluded_via_build1_link", ncbiTaxid: t, scientificName: tax.lineage(t)?.name ?? null, refseq: choice.get(t)!.chosen.header.version, source: null, sourceName: null,
      detail: `RefSeq species linked to build 1 row ${o?.id} (${o?.s.species}, ${o?.s.refseq}) through its AnAge entry, while that row's cited record resolves to NCBI species ${o?.spTaxid}; not added as a new species.`,
    });
  }

  // -------------------------------------------------------------- originals: RefSeq status
  const taken = new Set(kept.map((s) => s.refseq));
  interface OrigPlan extends Orig {
    version: string | null;
    change: AccessionChange | null;
    retiredReason: string | null;
    lifespanObs: MatchedObservation | SourceObservation | null;
  }
  const anageObsByHagrid = new Map(inp.observations.filter((o) => o.source === "AnAge").map((o) => [o.sourceRecordId, o]));
  const plans: OrigPlan[] = origs.map((o) => {
    const cited = o.s.refseq;
    const acc = cited.split(".")[0]!;
    let version: string | null = null;
    let change: AccessionChange | null = null;
    let retiredReason: string | null = null;
    if (release.byVersion.has(cited)) version = cited;
    else if (release.byAccession.has(acc)) {
      version = release.byAccession.get(acc)!.version;
      change = { from: cited, to: version, kind: "upstream_version_change" };
    } else {
      const succ = successorFor(choice.get(o.eff!), taken);
      if (succ) {
        version = succ.header.version;
        taken.add(version);
        change = { from: cited, to: version, kind: "refseq_successor" };
      } else {
        retiredReason = `RefSeq ${cited} is not in ${RS} (suppressed) and the release has no other complete mitogenome of NCBI species ${o.eff} (${tax.lineage(o.eff!)?.name ?? "?"}); no longer qualifies under the RefSeq-only rule`;
      }
    }
    // Lifespan: AnAge build 15 through the build 1 link; a secondary source only when AnAge has no value.
    let lifespanObs: MatchedObservation | SourceObservation | null = null;
    const an = o.entry ? anageObsByHagrid.get(o.entry.hagrid) : undefined;
    if (an && an.valueYears !== null) lifespanObs = an;
    else {
      const secondary = (byTaxid.get(o.eff!) ?? []).filter((x) => x.source !== "AnAge");
      lifespanObs = chooseLifespan(secondary, groupOfBuild1(o.s));
      if (!lifespanObs) {
        const why = `${o.entry ? `AnAge build 15 entry ${o.entry.hagrid} has no maximum longevity` : "no AnAge build 15 entry"} and no secondary lifespan source applies (${groupOfBuild1(o.s)}: ${o.s.class})`;
        retiredReason = retiredReason ? `${retiredReason}; ${why}` : `${why}; no longer qualifies (no curated lifespan)`;
      }
    }
    return { ...o, version, change, retiredReason, lifespanObs };
  });

  // -------------------------------------------------------------- candidates
  interface Cand {
    t: number;
    rec: ReleaseRecord;
    group: TaxonGroup;
    chosen: MatchedObservation;
    obs: MatchedObservation[];
    hagrid: string | null;
  }
  const cands: Cand[] = [];
  for (const [t, ch] of choice) {
    if (origTaxa.has(t)) continue;
    const group = taxonGroup(ch.chosen.header.lineage);
    const obs = byTaxid.get(t) ?? [];
    const chosen = chooseLifespan(obs, group);
    if (!chosen) continue;
    const hagrid = obs.find((o) => o.source === "AnAge")?.sourceRecordId ?? null;
    if (hagrid && origHagrids.has(hagrid)) {
      review.push({
        reviewType: "anage_entry_linked_to_build1", ncbiTaxid: t, scientificName: tax.lineage(t)?.name ?? null, refseq: ch.chosen.header.version, source: "AnAge", sourceName: null,
        detail: `AnAge HAGRID ${hagrid} is already linked to a build 1 species (taxonomic split or reassignment); not added.`,
      });
      continue;
    }
    cands.push({ t, rec: ch.chosen, group, chosen, obs, hagrid });
  }

  // -------------------------------------------------------------- genomes
  const wanted = [...plans.filter((p) => p.version && !p.retiredReason).map((p) => p.version!), ...cands.map((c) => c.rec.header.version)];
  const texts = await release.records(wanted);
  // Records assembled from contigs have no ORIGIN in the release file: fetch the same accession.version with its sequence.
  const contigOnly = [...texts].filter(([, t]) => !/\nORIGIN/.test(t)).map(([v]) => v).sort();
  if (contigOnly.length) {
    const full = await inp.fetchWithParts(contigOnly);
    for (const v of contigOnly) {
      const t = full.get(v);
      const h = release.byVersion.get(v)!;
      if (!t) throw new Error(`no sequence for ${v}: the release record has only a CONTIG line and efetch did not return it`);
      const got = /^VERSION\s+(\S+)/m.exec(t)?.[1];
      const seqLen = annotateGenome(t, 2, false).record.sequence.length;
      if (got !== v || seqLen !== h.length) throw new Error(`efetch record for ${v} is ${got} with ${seqLen} bp (release header: ${h.length} bp)`);
      texts.set(v, t);
    }
  }

  const anageByHagrid = new Map(inp.anage.entries.map((e) => [e.hagrid, e]));
  const species: Species[] = [];
  const stats: RegionStats[] = [];
  const usage: Usage[] = [];
  const features = new Map<number, GenomeFeature[]>();
  const observations: Omit<LifespanObservation, "provenance">[] = [];
  const retiredRows: { table: string; key: string }[] = [];
  const taxidOf = new Map<number, number | null>();
  const extra: Build2["extra"] = new Map();
  const statusOf = new Map<number, RecordStatus>();
  const changeKinds = new Map<number, Set<string>>();
  const kind = (id: number, k: string) => (changeKinds.get(id) ?? changeKinds.set(id, new Set()).get(id)!).add(k);
  const baseSpecies = new Map(base.species.map((s) => [s.id, s]));
  const baseStats = new Map<number, RegionStats[]>();
  for (const r of base.stats) (baseStats.get(r.speciesId) ?? baseStats.set(r.speciesId, []).get(r.speciesId)!).push(r);
  const baseUsage = new Map<number, Usage[]>();
  for (const r of base.usage) (baseUsage.get(r.speciesId) ?? baseUsage.set(r.speciesId, []).get(r.speciesId)!).push(r);
  let primaryUsed = 0;
  const flags = new Map<number, string[]>();
  const flag = (id: number, f: string) => (flags.get(id) ?? flags.set(id, []).get(id)!).push(f);

  for (const p of plans) {
    const { s, id } = p;
    const b1 = baseSpecies.get(id)!;
    const live = !p.retiredReason;
    let g: SpeciesGenome = p.g1;
    let gText = base.citedText.get(id)!;
    let rows: { stats: RegionStats[]; usage: Usage[]; features: GenomeFeature[]; nonCoding: number };
    if (live) {
      gText = texts.get(p.version!)!;
      g = annotateGenome(gText, fallbackTable(s.phylum), s.phylum === "Chordata");
      if (g.record.accessionVersion !== p.version) throw new Error(`release record ${g.record.accessionVersion} != ${p.version}`);
      rows = genomeRows(id, g);
    } else {
      // Retired: the build 1 rows exactly (no gap fill from a record that left RefSeq).
      rows = {
        stats: (baseStats.get(id) ?? []).filter((r) => r.source === "mitoage"),
        usage: (baseUsage.get(id) ?? []).filter((r) => r.source === "mitoage"),
        features: base.features.get(id) ?? [],
        nonCoding: b1.nonCodingBp ?? 0,
      };
    }
    // Source INSDC record, to recognise a same-version re-annotation.
    let primary: { accession: string; genome: SpeciesGenome } | null = null;
    if (!p.change) {
      const pa = primaryAccession(gText);
      const pt = pa ? primaryText(pa) : null;
      if (pt) {
        primary = { accession: pt.accession, genome: annotateGenome(pt.text, fallbackTable(s.phylum), s.phylum === "Chordata") };
        primaryUsed++;
      }
    }
    const csvComposition = new Map<Region, import("../sources/mitoage").RawComposition[]>();
    for (const [region, m] of raw.composition) {
      const r = m.get(id);
      if (r?.length) csvComposition.set(region, r);
    }
    const csvCodons = new Map<string, Record<string, number>>();
    for (const [region, m] of raw.codons) {
      const r = m.get(id);
      if (r) csvCodons.set(region, r.counts);
    }
    const d = diffGenome({
      id, csvComposition, csvCodons, emittedStats: rows.stats, emittedCodons: rows.usage, evidence: g, evidenceText: gText, primary,
      accessionChange: p.change, baselineFeatures: base.features.get(id) ?? [], emittedFeatures: rows.features,
    });
    const recVersion = live ? p.version! : s.refseq;
    for (const c of d.changes) {
      log(c, RS, recVersion);
      if (c.table !== "species") kind(id, p.change ? "genome" : c.changeType === "correction" ? "correction" : "annotation");
    }
    // Rows of build 1 not in the build 2 record are kept, as retired rows.
    for (const k of d.removed) {
      const [table, , region] = k.split(":");
      retiredRows.push({ table: table!, key: k });
      if (table === "region_stats") {
        const r = csvComposition.get(region as Region)![0]!;
        rows.stats.push(makeStats(id, region as Region, { a: r.labelT, c: r.labelG, g: r.labelC, t: r.labelA, other: r.other }, "mitoage"));
      } else if (table === "codon_usage") {
        const counts = csvCodons.get(region!)!;
        rows.usage.push({ speciesId: id, region: region as (typeof PROTEIN_GENES)[number], counts, aminoAcids: aminoAcidCounts(counts, g.translTable), source: "mitoage", translTable: g.translTable });
      } else if (table === "genome_features") {
        const fk = k.slice(`genome_features:${id}:`.length);
        const bf = base.features.get(id) ?? [];
        const keys = featureKeys(bf);
        const f = bf[keys.indexOf(fk)];
        if (f) rows.features.push(f);
      }
    }
    rows.features.sort((a, b) => a.start - b.start || a.end - b.end);
    if (live && d.removed.length) flag(id, `rows_not_in_current_record:${d.removed.length}`);

    // ---- species fields
    const csvTotal = raw.composition.get("total_mtDNA")!.get(id)![0]!;
    const total = rows.stats.find((r) => r.region === "total_mtDNA")!;
    const accClass: Classification | null = p.change
      ? { changeType: "value_update", diffClass: p.change.kind, reason: p.change.kind === "refseq_successor" ? `RefSeq ${p.change.from} was suppressed; switched to the live RefSeq mitogenome of the same species ${p.change.to} (species-level record, newest full-length)` : `RefSeq record replaced by a new sequence version ${p.change.from} -> ${p.change.to}`, scope: "row" }
      : null;
    if (p.change) {
      sp(id, "refseq", p.change.from, p.change.to, accClass!, RS, p.change.to);
      kind(id, "genome");
    }
    if (live && csvTotal.lengthBp !== total.lengthBp) sp(id, "mtdna_size_bp", csvTotal.lengthBp, total.lengthBp, accClass ?? { changeType: "correction", diffClass: "build1_disagrees_with_cited_record", reason: "Genome length differs from the cited record", scope: "row" }, RS, recVersion);
    const gcNow = live ? round(total.gcPercent, 3) : b1.gcPercent;
    if (live && accClass && gcNow !== b1.gcPercent) sp(id, "gc_percent", b1.gcPercent, gcNow, accClass, RS, recVersion);
    const nonCoding = live ? rows.nonCoding : b1.nonCodingBp;
    if (csvTotal.nonCodingBp !== nonCoding) {
      let c: Classification;
      if (accClass) c = accClass;
      else if (d.aggregates.length) {
        c = {
          changeType: d.aggregates.every((a) => a.c.changeType === "value_update") ? "value_update" : "correction",
          diffClass: "derived_from_region_differences",
          reason: `Non-coding length = genome minus CDS/rRNA/tRNA coverage; differs because aggregate regions differ (${d.aggregates.map((a) => a.region).join(", ")})`,
          scope: d.aggregates.every((a) => a.c.scope === "rule") ? "rule" : "row",
        };
      } else {
        c = { changeType: "correction", diffClass: "build1_disagrees_with_cited_record", reason: "Build-1 non-coding length not reproducible from the cited record (genome minus union of CDS, rRNA, tRNA); no aggregate-region difference explains it", scope: "row" };
      }
      sp(id, "non_coding_bp", csvTotal.nonCodingBp, nonCoding, c, RS, recVersion);
      kind(id, p.change ? "genome" : c.changeType === "correction" ? "correction" : "annotation");
    }
    const recTaxidNow = live ? (g.taxid === null ? null : tax.current(g.taxid)) : p.recTaxid;
    if (p.g1.taxid !== recTaxidNow) {
      sp(id, "ncbi_taxid", p.g1.taxid, recTaxidNow, accClass ?? { changeType: "value_update", diffClass: "ncbi_taxid_merged", reason: `NCBI merged taxid ${p.g1.taxid} into ${recTaxidNow}`, scope: "row" }, "NCBI Taxonomy", tax.version);
      kind(id, "ncbi_taxid");
    }
    // Lifespan
    const lo = p.lifespanObs;
    const maxLongevity = lo ? lo.valueYears! : s.maxLongevityYears;
    if (lo && maxLongevity !== s.maxLongevityYears) {
      const e = p.entry;
      sp(id, "max_longevity_years", s.maxLongevityYears, maxLongevity, {
        changeType: "value_update", diffClass: lo.source === "AnAge" ? "anage_longevity_revised" : "secondary_source_fills_missing_anage",
        reason: lo.source === "AnAge" ? `AnAge build 15 revised maximum longevity (quality ${e?.dataQuality}, sample size ${e?.sampleSize}, origin ${e?.specimenOrigin})` : `AnAge build 15 has no value; ${lo.source} fills it under the per-taxon priority`,
        scope: "row",
      }, lo.source, lo.sourceVersion);
      kind(id, "lifespan");
    }
    // Names: NCBI is the naming authority; build 1 names kept in previousScientificNames.
    const ncbiName = tax.lineage(p.eff!)?.name ?? null;
    const recSpeciesName = p.spTaxid === null ? null : (tax.lineage(p.spTaxid)?.name ?? null);
    let name = s.species;
    const previous: string[] = [];
    const nc = nameChange(s.species, ncbiName);
    if (nc && RENAME_CLASSES.has(nc)) {
      const syn = tax.taxonNames(p.eff!)?.synonyms.includes(s.species);
      sp(id, "scientific_name", s.species, ncbiName, { changeType: "renamed", diffClass: `ncbi_${nc}`, reason: `${nc}; build-1 name ${syn ? "is" : "is not"} listed as an NCBI synonym; AnAge build 15 name: ${p.entry?.scientificName ?? "-"}`, scope: "row" }, "NCBI Taxonomy", tax.version);
      name = ncbiName!;
      previous.push(s.species);
      kind(id, "name");
    }
    const recNc = nameChange(s.species, recSpeciesName);
    if (recNc === "different_species_name" || nc === "different_species_name") {
      flag(id, `cited_record_resolves_to_other_species:${recSpeciesName}`);
    }
    if (p.entry && nameChange(name, p.entry.scientificName) === "different_species_name") flag(id, `anage_name_differs:${p.entry.scientificName}`);
    if (p.eff !== p.spTaxid) flag(id, `ncbi_taxid_shared_in_build1:${p.spTaxid}`);
    const genus = name.split(" ")[0]!;
    const commonName = p.entry?.commonName || s.commonName;
    const taxonomy = {
      kingdom: s.kingdom,
      phylum: p.entry?.phylum || s.phylum,
      class: s.class, // build 1 class scheme kept (owner default e)
      order: p.entry?.order || s.order,
      family: p.entry?.family || s.family,
      genus,
    };
    if (genus !== s.genus) sp(id, "genus", s.genus, genus, { changeType: "renamed", diffClass: "follows_scientific_name", reason: "Genus follows the renamed scientific name", scope: "row" }, "NCBI Taxonomy", tax.version);
    for (const [field, old, now] of [
      ["common_name", s.commonName, commonName],
      ["phylum", s.phylum, taxonomy.phylum],
      ["order", s.order, taxonomy.order],
      ["family", s.family, taxonomy.family],
    ] as const) {
      if (old === now) continue;
      sp(id, field, old, now, { changeType: "value_update", diffClass: "anage_taxonomy_revision", reason: "AnAge build 15 taxonomy/common-name revision", scope: "row" }, "AnAge", ANAGE_PINNED.version);
      kind(id, field === "common_name" ? "common_name" : "taxonomy");
    }
    if (p.retiredReason) {
      const noRecord = !p.version;
      sp(id, "record_status", "original", "retired", { changeType: "retired", diffClass: noRecord ? "refseq_suppressed_no_successor" : "no_curated_lifespan", reason: p.retiredReason, scope: "row" }, noRecord ? RS : "AnAge", noRecord ? s.refseq : ANAGE_PINNED.version);
    }
    const lifespan: LifespanInfo = lo
      ? lifespanOf(lo)
      : { source: "MitoAge_build1", sourceVersion: "MitoAge build 1 (2015-07-01)", sourceRecordId: String(id), quality: null, sampleSize: null, recordType: "compiled", license: BUILD1_LICENSE };
    if (!lo) flag(id, "lifespan_from_build1_only");
    if (lo?.source === "USGS_BBL" && !inp.euringRetrieved) flag(id, "lifespan_provisional_euring_not_retrieved");
    species.push({
      id, slug: b1.slug, refseq: live ? p.version! : s.refseq, scientificName: name, commonName, taxonomy,
      maxLongevityYears: maxLongevity, mtdnaSizeBp: live ? total.lengthBp : b1.mtdnaSizeBp, nonCodingBp: nonCoding, gcPercent: gcNow,
      traits: b1.traits, legacyId: b1.legacyId, ncbiTaxid: recTaxidNow, ncbiSpeciesTaxid: p.eff, lifespan,
      previousScientificNames: previous, retiredReason: p.retiredReason, reviewFlags: [], changeKinds: [],
    });
    statusOf.set(id, p.retiredReason ? "retired" : previous.length ? "renamed" : "original");
    stats.push(...rows.stats);
    usage.push(...rows.usage);
    features.set(id, rows.features);
    taxidOf.set(id, recTaxidNow);
    const m = base.anageMatch.get(id)!;
    extra.set(id, { anageHagrid: m.entry?.hagrid ?? null, anageMatch: m.how, anageMaxLongevityYears: m.entry?.maxLongevityYears ?? null, ncbiTaxid: recTaxidNow, translTable: g.translTable });
    // Observations: AnAge through the build 1 link, other sources by NCBI species, and the build 1 value.
    const an = p.entry ? anageObsByHagrid.get(p.entry.hagrid) : undefined;
    const obsHere: (SourceObservation & { matchMethod: string })[] = [];
    if (an && an.valueYears !== null) obsHere.push({ ...an, matchMethod: "build1_hagrid_link" });
    for (const o of byTaxid.get(p.eff!) ?? []) if (o.source !== "AnAge" && o.valueYears !== null) obsHere.push(o);
    for (const o of obsHere) observations.push(toObservation(id, p.eff!, o, o === lo || (lo !== null && o.sourceRecordId === lo.sourceRecordId && o.source === lo.source)));
    observations.push({
      speciesId: id, ncbiTaxid: p.eff!, source: "MitoAge_build1", sourceVersion: "MitoAge build 1 (2015-07-01)", sourceRecordId: String(id), sourceName: s.species,
      valueYears: s.maxLongevityYears, recordType: "compiled", quality: null, sampleSizeText: null, sex: null, detail: "build-1 max_longevity_years (AnAge build 12-era)",
      reference: null, license: BUILD1_LICENSE, matchMethod: "build1_row", isChosen: !lo,
    });
  }

  // -------------------------------------------------------------- new species
  const usedSlugs = new Set(species.map((s) => s.slug));
  const usedIds = new Set(species.map((s) => s.id));
  for (const c of cands.sort((a, b) => a.t - b.t)) {
    const id = mintId(c.t);
    if (usedIds.has(id)) throw new Error(`minted id ${id} collides`);
    usedIds.add(id);
    const lin = tax.lineage(c.t);
    if (!lin) throw new Error(`no NCBI lineage for species ${c.t}`);
    const text = texts.get(c.rec.header.version)!;
    const g = annotateGenome(text, fallbackTable(lin.phylum), lin.phylum === "Chordata");
    const rows = genomeRows(id, g);
    const entry = c.hagrid ? (anageByHagrid.get(c.hagrid) ?? null) : null;
    const name = lin.name;
    let slug = slugify(name);
    if (usedSlugs.has(slug)) slug = `${slug}-${slugify(c.rec.header.version)}`;
    usedSlugs.add(slug);
    const total = rows.stats.find((r) => r.region === "total_mtDNA")!;
    const traits: Traits = entry ? { ...entry.traits, source: `AnAge build 15 (HAGRID ${entry.hagrid})` } : emptyTraits();
    species.push({
      id, slug, refseq: c.rec.header.version, scientificName: name,
      commonName: entry?.commonName || c.chosen.sourceCommonName || tax.taxonNames(c.t)?.genbankCommon || "",
      taxonomy: {
        // No class rank in NCBI: the AnAge class when the species has an AnAge entry; otherwise unknown ("").
        kingdom: "Animalia", phylum: lin.phylum, class: harmonisedClass(c.rec.header.lineage, lin.class) ?? entry?.class ?? "",
        order: lin.order, family: lin.family, genus: lin.genus || name.split(" ")[0]!,
      },
      maxLongevityYears: c.chosen.valueYears!, mtdnaSizeBp: total.lengthBp, nonCodingBp: rows.nonCoding, gcPercent: round(total.gcPercent, 3),
      traits, legacyId: null, ncbiTaxid: c.rec.taxidCurrent, ncbiSpeciesTaxid: c.t, lifespan: lifespanOf(c.chosen),
      previousScientificNames: [], retiredReason: null, reviewFlags: [], changeKinds: [],
    });
    if (c.chosen.source === "USGS_BBL" && !inp.euringRetrieved) flag(id, "lifespan_provisional_euring_not_retrieved");
    statusOf.set(id, "new");
    stats.push(...rows.stats);
    usage.push(...rows.usage);
    features.set(id, rows.features);
    taxidOf.set(id, c.rec.taxidCurrent);
    extra.set(id, { anageHagrid: entry?.hagrid ?? null, anageMatch: entry ? "ncbi name match" : "none", anageMaxLongevityYears: entry?.maxLongevityYears ?? null, ncbiTaxid: c.rec.taxidCurrent, translTable: g.translTable });
    const added: Classification = {
      changeType: "added", diffClass: "new_species",
      reason: `Complete RefSeq mitogenome (${c.rec.header.version}, ${c.rec.completeness}${c.rec.header.length ? `, ${c.rec.header.length} bp` : ""}) and a maximum lifespan from ${c.chosen.source} (${c.group} priority: ${c.chosen.source === "AnAge" ? "AnAge" : "AnAge has no value"})`,
      scope: "row",
    };
    log({ table: "species", rowKey: String(id), field: "(row)", oldValue: null, newValue: `${name} ${c.rec.header.version}`, ...added }, RS, c.rec.header.version);
    for (const [table, n] of [["region_stats", rows.stats.length], ["codon_usage", rows.usage.length], ["genome_features", rows.features.length]] as const) {
      log({ table, rowKey: `${id}:*`, field: "(rows)", oldValue: null, newValue: `${n} rows`, ...added, reason: `Rows of new species ${name}` }, RS, c.rec.header.version);
    }
    for (const o of c.obs) if (o.valueYears !== null) observations.push(toObservation(id, c.t, o, o === c.chosen));
  }

  // -------------------------------------------------------------- review flags, possible duplicates, review list
  const byName = new Map(species.map((s) => [s.scientificName, s]));
  for (const [a, b, why] of POSSIBLE_DUPLICATES) {
    const sa = byName.get(a);
    const sb = byName.get(b);
    if (!sa || !sb) continue;
    flag(sa.id, `possible_duplicate_species:${b}`);
    flag(sb.id, `possible_duplicate_species:${a}`);
    review.push({ reviewType: "possible_duplicate_species", ncbiTaxid: null, scientificName: `${a} (${sa.id}); ${b} (${sb.id})`, refseq: `${sa.refseq}; ${sb.refseq}`, source: null, sourceName: null, detail: `${why}; both kept and flagged (owner default h)` });
  }
  const refseqGenera = new Set([...choice.keys()].map((t) => (tax.lineage(t)?.name ?? "").split(" ")[0]!.toLowerCase()));
  const inBuild = new Set(species.map((s) => s.ncbiSpeciesTaxid));
  const ms = [...inp.matches.values()].sort((a, b) => (a.source + a.sourceName < b.source + b.sourceName ? -1 : a.source + a.sourceName > b.source + b.sourceName ? 1 : (a.speccode ?? 0) - (b.speccode ?? 0)));
  for (const m of ms) {
    const genus = m.sourceName.toLowerCase().split(" ")[0]!;
    if (m.status === "unmatched" && refseqGenera.has(genus)) {
      review.push({ reviewType: "source_name_unmatched", ncbiTaxid: null, scientificName: null, refseq: null, source: m.source, sourceName: m.sourceName, detail: `no NCBI scientific name or synonym; the release has complete mitogenomes in genus ${m.sourceName.split(" ")[0]}` });
    } else if (m.status === "conflict_secondary" || m.status === "ambiguous" || m.status === "ambiguous_many_to_one") {
      const ids = [...m.candidates, ...(m.speciesTaxid !== null ? [m.speciesTaxid] : [])];
      if (!ids.some((t) => choice.has(t))) continue;
      review.push({ reviewType: `source_name_${m.status}`, ncbiTaxid: m.speciesTaxid, scientificName: m.speciesTaxid ? (tax.lineage(m.speciesTaxid)?.name ?? null) : null, refseq: null, source: m.source, sourceName: m.sourceName, detail: `match_method=${m.method}; candidate taxids=${m.candidates.join(";") || "-"}; not used` });
      for (const t of ids) {
        const s = species.find((x) => x.ncbiSpeciesTaxid === t);
        if (s && inBuild.has(t)) flag(s.id, `source_match_in_review:${m.source}:${m.sourceName}`);
      }
    }
  }

  // -------------------------------------------------------------- rules logged once
  const rule = (table: string, field: string, oldValue: string, newValue: string, diffClass: string, reason: string, src: string, ver: string, rowKey = "*") =>
    changelog.push({ build: BUILD, changedAt: buildDate, table, rowKey, field, oldValue, newValue, changeType: "correction", diffClass, reason, upstreamSource: src, upstreamVersion: ver, scope: "rule" });
  for (const [f, col] of [["a", "T"], ["c", "G"], ["g", "C"], ["t", "A"]] as const) {
    rule("region_stats", f, `CSV column "${col}"`, `true RefSeq-strand ${f.toUpperCase()} count (= CSV "${col}")`, "rule_label_complement",
      "Build-1 CSV base columns are complement-labelled (G<->C, A<->T); verified on total_mtDNA for every species; GC% unaffected, GC and AT skews flip sign", "MitoAge build-1 CSV export vs RefSeq sequences", "pipeline rule (fixCsvLabels)");
  }
  rule("region_stats", "length_bp", "start..end span of segmented features", "sum of annotated segments only", "rule_full_span",
    "Build 1 counted the full start..end span of join() features (e.g. avian/turtle ND3 frameshift nucleotide); build 2 counts annotated segments only (owner default f); per-row instances carry diff_class=rule_full_span", "RefSeq feature tables", "pipeline rule (coverage of segments)");
  rule("species", "record_status", "in CSV export (923rd row)", "excluded", "rule_exclusion",
    "Loxioides bailleui NC_025626.1 is 9,243 bp (not a complete mitogenome); not in the published 922; excluded from every build", "NCBI nuccore", "NC_025626.1", "HAGRID 1598");
  changelog.push({ build: BUILD, changedAt: buildDate, table: "lifespan_observations", rowKey: "*", field: "(table)", oldValue: null, newValue: `${observations.length} rows`,
    changeType: "added", diffClass: "new_table", reason: "Every lifespan value from every source kept in long format (decisions section 2); new in build 2", upstreamSource: "AnAge, FishBase, SeaLifeBase, USGS BBL", upstreamVersion: "see source_version", scope: "rule" });

  // -------------------------------------------------------------- provenance
  const touched = new Map<string, { added: boolean }>();
  for (const c of changelog) {
    if (c.rowKey === "*" || c.rowKey.endsWith(":*")) continue;
    const k = `${c.table}:${c.rowKey}`;
    const t = touched.get(k) ?? { added: false };
    if (c.field === "(row)" && c.oldValue === null) t.added = true;
    touched.set(k, t);
  }
  const retiredKeys = new Set(retiredRows.map((r) => r.key));
  const speciesModified = new Set<number>();
  for (const k of touched.keys()) speciesModified.add(Number(k.split(":")[1]));
  const prov = (added: number, status: RecordStatus, modified: boolean, sourceVersion: string): RowProvenance => ({
    addedInBuild: added, addedAt: added === 1 ? BUILD1_DATE : buildDate, lastModifiedBuild: modified ? BUILD : null,
    lastModifiedAt: modified ? buildDate : null, recordStatus: status, sourceVersion,
  });
  for (const s of species) {
    const st0 = statusOf.get(s.id)!;
    const modified = speciesModified.has(s.id);
    const st: RecordStatus = st0 === "original" && modified ? "updated" : st0;
    s.reviewFlags = [...new Set(flags.get(s.id) ?? [])].sort();
    s.changeKinds = [...(changeKinds.get(s.id) ?? [])].sort();
    s.provenance = prov(st === "new" ? 2 : 1, st, st === "new" ? false : modified, `${s.refseq}; ${s.lifespan!.sourceVersion}`);
  }
  const spStatus = new Map(species.map((s) => [s.id, s.provenance!.recordStatus]));
  const childProv = (table: string, id: number, key: string, ver: string): RowProvenance => {
    const sst = spStatus.get(id)!;
    const k = `${table}:${key}`;
    const t = touched.get(k);
    if (sst === "new") return prov(2, "new", false, ver);
    if (sst === "retired" || retiredKeys.has(k)) return prov(t?.added ? 2 : 1, "retired", !!t && !t.added, ver);
    if (t?.added) return prov(2, "new", false, ver);
    return prov(1, t ? "updated" : "original", !!t, ver);
  };
  const refOf = new Map(species.map((s) => [s.id, s.refseq]));
  for (const r of stats) r.provenance = childProv("region_stats", r.speciesId, `${r.speciesId}:${r.region}`, r.source === "mitoage" ? `${refOf.get(r.speciesId)} (build 1 CSV)` : refOf.get(r.speciesId)!);
  for (const u of usage) u.provenance = childProv("codon_usage", u.speciesId, `${u.speciesId}:${u.region}`, u.source === "mitoage" ? `${refOf.get(u.speciesId)} (build 1 CSV)` : refOf.get(u.speciesId)!);
  for (const [id, fs] of features) {
    const keys = featureKeys(fs);
    fs.forEach((f, i) => (f.provenance = childProv("genome_features", id, `${id}:${keys[i]}`, refOf.get(id)!)));
  }
  const obsOut: LifespanObservation[] = observations.map((o) => ({ ...o, provenance: prov(2, "new", false, o.sourceVersion) }));

  // -------------------------------------------------------------- deterministic order
  species.sort((a, b) => a.id - b.id);
  const regionOrder = new Map(REGIONS.map((r, i) => [r, i]));
  stats.sort((a, b) => a.speciesId - b.speciesId || regionOrder.get(a.region)! - regionOrder.get(b.region)!);
  const codonOrder = new Map<string, number>([...PROTEIN_GENES, "total_pc"].map((r, i) => [r, i]));
  usage.sort((a, b) => a.speciesId - b.speciesId || codonOrder.get(a.region)! - codonOrder.get(b.region)!);
  const sortedFeatures = new Map([...features].sort((a, b) => a[0] - b[0]));
  const srcOrder = ["AnAge", "FishBase", "SeaLifeBase", "EURING", "USGS_BBL", "MitoAge_build1"];
  obsOut.sort((a, b) => a.speciesId - b.speciesId || srcOrder.indexOf(a.source) - srcOrder.indexOf(b.source) || cmp(a.sourceRecordId, b.sourceRecordId));
  const keyNum = (k: string) => (k === "*" || k.startsWith("HAGRID") ? -1 : Number(k.split(":")[0]));
  changelog.sort((a, b) => keyNum(a.rowKey) - keyNum(b.rowKey) || cmp(a.table, b.table) || cmp(a.rowKey, b.rowKey) || cmp(a.field, b.field) || cmp(a.diffClass, b.diffClass) || cmp(a.oldValue ?? "", b.oldValue ?? ""));
  review.sort((a, b) => cmp(a.reviewType, b.reviewType) || cmp(a.source ?? "", b.source ?? "") || cmp(a.sourceName ?? a.scientificName ?? "", b.sourceName ?? b.scientificName ?? ""));

  return {
    species, stats, usage, features: sortedFeatures, observations: obsOut, changelog, review, taxidOf, extra,
    report: { primaryRecordsUsed: primaryUsed, candidates: cands.length, retiredChildRows: retiredRows.length, contigOnlyFetched: contigOnly },
  };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function toObservation(speciesId: number, taxid: number, o: SourceObservation & { matchMethod: string }, chosen: boolean): Omit<LifespanObservation, "provenance"> {
  return {
    speciesId, ncbiTaxid: taxid, source: o.source, sourceVersion: o.sourceVersion, sourceRecordId: o.sourceRecordId, sourceName: o.sourceName,
    valueYears: o.valueYears!, recordType: o.recordType, quality: o.quality, sampleSizeText: o.sampleSizeText, sex: o.sex, detail: o.detail,
    reference: o.reference, license: o.license, matchMethod: o.matchMethod, isChosen: chosen,
  };
}
