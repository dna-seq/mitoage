/**
 * Writers for the committed pipeline output.
 *
 * src/data/generated/: small JSON the site reads directly (build-info, taxonomy tree, dated
 * phylogeny). public/data/: the parquet downloads, which are also the site's data source (the
 * data layer reads them at build time, decision D3); derived tables (feature values, correlations,
 * explorer.json) are computed during the site build and are not committed.
 */
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type {
  BuildInfo,
  ChangelogEntry,
  CodonUsage,
  GenomeFeature,
  LifespanObservation,
  RegionStats,
  RowProvenance,
  Species,
  TaxonNode,
} from "../../src/data/schema";
import { ROOT } from "../lib/cache";
import { toCsv } from "../lib/csv";
import { AMINO_ACIDS, CODONS } from "../lib/genetic-code";
import { type Column, writeParquet } from "../lib/parquet";
import { type PhyloNode, round } from "../lib/stats";
import { featureKeys } from "./diff";
import { type GeneFeatureRow, REPEAT_MIN_LENGTH, type StructureRow } from "./extended";
import type { MotifCounts } from "../lib/motifs";

export const GENERATED_DIR = join(ROOT, "src", "data", "generated");
export const PUBLIC_DATA_DIR = join(ROOT, "public", "data");

type Usage = CodonUsage & { source: "mitoage" | "genbank"; translTable: number };

const json = (v: unknown) => JSON.stringify(v);

async function write(path: string, content: string): Promise<number> {
  await Bun.write(path, content);
  return Buffer.byteLength(content);
}

/**
 * What other commands write into the two folders `bun run data` clears. They are kept: a data build that wiped
 * them left the site without its alignments, coevolution tables and complexes until three more commands ran.
 * A build that changes the species makes them stale, which `bun run data` says when it ends.
 */
export const KEPT_IN_GENERATED = ["complexes.json"]; // bun run complexes
export const KEPT_IN_PUBLIC_DATA = ["alignments", "mitoport"]; // bun run align, bun run mitoport

/** Empties `dir`, except the entries named in `keep` (top-level names); returns the kept ones that exist. */
export function resetDir(dir: string, keep: string[] = []): string[] {
  mkdirSync(dir, { recursive: true });
  const kept: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (keep.includes(name)) kept.push(name);
    else rmSync(join(dir, name), { recursive: true, force: true });
  }
  return kept;
}

export const AA_KEYS = [...AMINO_ACIDS, "*"];

export interface GeneratedPayload {
  buildInfo: BuildInfo;
  taxonomy: TaxonNode;
  /** Dated tree (leaf = species id), or null when no phylogeny could be built. */
  phylogeny: { version: string; root: PhyloNode } | null;
}

/** src/data/generated/*.json. Returns file sizes. */
export async function writeGenerated(p: GeneratedPayload): Promise<Record<string, number>> {
  resetDir(GENERATED_DIR, KEPT_IN_GENERATED);
  const sizes: Record<string, number> = {};
  sizes["build-info.json"] = await write(join(GENERATED_DIR, "build-info.json"), json(p.buildInfo));
  sizes["taxonomy.json"] = await write(join(GENERATED_DIR, "taxonomy.json"), json(p.taxonomy));
  sizes["phylogeny.json"] = await write(join(GENERATED_DIR, "phylogeny.json"), json(p.phylogeny));
  return sizes;
}

// ---------------- public/data downloads ----------------

export interface SpeciesExtra {
  anageHagrid: string | null;
  anageMatch: string;
  anageMaxLongevityYears: number | null;
  ncbiTaxid: number | null;
  translTable: number;
}

export interface ReviewRow {
  reviewType: string;
  ncbiTaxid: number | null;
  scientificName: string | null;
  refseq: string | null;
  source: string | null;
  sourceName: string | null;
  detail: string;
}


/** Motif columns of mtdna_structure.parquet, each written for the whole record and for the major arc. */
const MOTIF_COLUMNS: [string, (m: MotifCounts) => number | null][] = [
  ["g4_forward", (m) => m.g4Forward],
  ["g4_reverse", (m) => m.g4Reverse],
  ["purine_tracts", (m) => m.purineTracts],
  ["pyrimidine_tracts", (m) => m.pyrimidineTracts],
  ["homopolymer_runs", (m) => m.homopolymerRuns],
  ["longest_homopolymer", (m) => m.longestHomopolymer],
  ["str_dinucleotide", (m) => m.strDinucleotide],
  ["str_trinucleotide", (m) => m.strTrinucleotide],
  ["str_tetranucleotide", (m) => m.strTetranucleotide],
  ["str_bases", (m) => m.strBases],
];

export interface PublicPayload {
  species: Species[];
  /** Extended mtDNA features, written as two per-species tables the site derives its features from. */
  extended: { structure: StructureRow[]; genes: GeneFeatureRow[] };
  stats: RegionStats[];
  usage: Usage[];
  features: Map<number, GenomeFeature[]>;
  observations: LifespanObservation[];
  changelog: ChangelogEntry[];
  review: ReviewRow[];
  extra: Map<number, SpeciesExtra>;
}

export const PROVENANCE_COLUMNS = ["added_in_build", "added_at", "last_modified_build", "last_modified_at", "record_status", "source_version"] as const;

function provenanceColumns(rows: (RowProvenance | undefined)[]): Column[] {
  const get = (f: (p: RowProvenance) => unknown) =>
    rows.map((p) => {
      if (!p) throw new Error("row without provenance");
      return f(p);
    });
  return [
    { name: "added_in_build", type: "INT32", data: get((p) => p.addedInBuild) },
    { name: "added_at", type: "STRING", data: get((p) => p.addedAt) },
    { name: "last_modified_build", type: "INT32", data: get((p) => p.lastModifiedBuild) },
    { name: "last_modified_at", type: "STRING", data: get((p) => p.lastModifiedAt) },
    { name: "record_status", type: "STRING", data: get((p) => p.recordStatus) },
    { name: "source_version", type: "STRING", data: get((p) => p.sourceVersion) },
  ];
}

const list = (v: string[] | undefined) => (v && v.length ? v.join("; ") : null);

export function speciesColumns(species: Species[], extra: Map<number, SpeciesExtra>): Column[] {
  const e = (s: Species) => extra.get(s.id);
  const col = (name: string, type: Column["type"], f: (s: Species) => unknown): Column => ({ name, type, data: species.map(f) });
  return [
    col("id", "INT32", (s) => s.id),
    col("slug", "STRING", (s) => s.slug),
    col("scientific_name", "STRING", (s) => s.scientificName),
    col("common_name", "STRING", (s) => s.commonName),
    col("refseq", "STRING", (s) => s.refseq),
    col("kingdom", "STRING", (s) => s.taxonomy.kingdom),
    col("phylum", "STRING", (s) => s.taxonomy.phylum),
    col("class", "STRING", (s) => s.taxonomy.class),
    col("order", "STRING", (s) => s.taxonomy.order),
    col("family", "STRING", (s) => s.taxonomy.family),
    col("genus", "STRING", (s) => s.taxonomy.genus),
    col("max_longevity_years", "DOUBLE", (s) => s.maxLongevityYears),
    col("mtdna_size_bp", "INT32", (s) => s.mtdnaSizeBp),
    col("non_coding_bp", "INT32", (s) => s.nonCodingBp),
    col("gc_percent", "DOUBLE", (s) => s.gcPercent),
    col("legacy_id", "INT32", (s) => s.legacyId),
    col("adult_weight_g", "DOUBLE", (s) => s.traits.adultWeightG),
    col("birth_weight_g", "DOUBLE", (s) => s.traits.birthWeightG),
    col("metabolic_rate_w", "DOUBLE", (s) => s.traits.metabolicRateW),
    col("body_temperature_k", "DOUBLE", (s) => s.traits.bodyTemperatureK),
    col("female_maturity_days", "DOUBLE", (s) => s.traits.femaleMaturityDays),
    col("male_maturity_days", "DOUBLE", (s) => s.traits.maleMaturityDays),
    col("gestation_days", "DOUBLE", (s) => s.traits.gestationDays),
    col("litter_size", "DOUBLE", (s) => s.traits.litterSize),
    col("litters_per_year", "DOUBLE", (s) => s.traits.littersPerYear),
    col("growth_rate_per_day", "DOUBLE", (s) => s.traits.growthRatePerDay),
    col("traits_source", "STRING", (s) => s.traits.source),
    col("anage_build15_hagrid", "STRING", (s) => e(s)?.anageHagrid ?? null),
    col("anage_match", "STRING", (s) => e(s)?.anageMatch ?? "none"),
    col("anage_build15_max_longevity_years", "DOUBLE", (s) => e(s)?.anageMaxLongevityYears ?? null),
    col("ncbi_taxid", "INT32", (s) => s.ncbiTaxid ?? null),
    col("ncbi_species_taxid", "INT32", (s) => s.ncbiSpeciesTaxid ?? null),
    col("transl_table", "INT32", (s) => e(s)?.translTable ?? null),
    col("lifespan_source", "STRING", (s) => s.lifespan?.source ?? null),
    col("lifespan_source_version", "STRING", (s) => s.lifespan?.sourceVersion ?? null),
    col("lifespan_source_record_id", "STRING", (s) => s.lifespan?.sourceRecordId ?? null),
    col("lifespan_quality", "STRING", (s) => s.lifespan?.quality ?? null),
    col("lifespan_sample_size", "STRING", (s) => s.lifespan?.sampleSize ?? null),
    col("lifespan_record_type", "STRING", (s) => s.lifespan?.recordType ?? null),
    col("lifespan_license", "STRING", (s) => s.lifespan?.license ?? null),
    col("previous_scientific_names", "STRING", (s) => list(s.previousScientificNames)),
    col("retired_reason", "STRING", (s) => s.retiredReason ?? null),
    col("review_flags", "STRING", (s) => list(s.reviewFlags)),
    col("data_confidence", "STRING", (s) => s.confidence?.level ?? null),
    col("data_confidence_reasons", "STRING", (s) => list(s.confidence?.reasons)),
    col("change_kinds", "STRING", (s) => list(s.changeKinds)),
    ...provenanceColumns(species.map((s) => s.provenance)),
  ];
}

export async function writePublic(p: PublicPayload, readme: string): Promise<Record<string, number>> {
  resetDir(PUBLIC_DATA_DIR, KEPT_IN_PUBLIC_DATA);
  const sizes: Record<string, number> = {};
  const slugOf = new Map(p.species.map((s) => [s.id, s.slug]));
  const out = async (name: string, cols: Column[]) => {
    sizes[name] = await writeParquet(join(PUBLIC_DATA_DIR, name), cols);
  };

  const sc = speciesColumns(p.species, p.extra);
  await out("species.parquet", sc);
  sizes["species.csv"] = await write(
    join(PUBLIC_DATA_DIR, "species.csv"),
    toCsv(sc.map((c) => c.name), p.species.map((_, i) => sc.map((c) => c.data[i]))),
  );

  const st = p.stats;
  await out("region_stats.parquet", [
    { name: "species_id", type: "INT32", data: st.map((s) => s.speciesId) },
    { name: "slug", type: "STRING", data: st.map((s) => slugOf.get(s.speciesId) ?? null) },
    { name: "region", type: "STRING", data: st.map((s) => s.region) },
    { name: "length_bp", type: "INT32", data: st.map((s) => s.lengthBp) },
    { name: "a", type: "INT32", data: st.map((s) => s.a) },
    { name: "c", type: "INT32", data: st.map((s) => s.c) },
    { name: "g", type: "INT32", data: st.map((s) => s.g) },
    { name: "t", type: "INT32", data: st.map((s) => s.t) },
    { name: "other", type: "INT32", data: st.map((s) => s.other) },
    { name: "gc_percent", type: "DOUBLE", data: st.map((s) => s.gcPercent) },
    { name: "gc_skew", type: "DOUBLE", data: st.map((s) => s.gcSkew) },
    { name: "at_skew", type: "DOUBLE", data: st.map((s) => s.atSkew) },
    { name: "source", type: "STRING", data: st.map((s) => s.source ?? "mitoage") },
    ...provenanceColumns(st.map((s) => s.provenance)),
  ]);

  const u = p.usage;
  await out("codon_usage.parquet", [
    { name: "species_id", type: "INT32", data: u.map((r) => r.speciesId) },
    { name: "slug", type: "STRING", data: u.map((r) => slugOf.get(r.speciesId) ?? null) },
    { name: "region", type: "STRING", data: u.map((r) => r.region) },
    { name: "transl_table", type: "INT32", data: u.map((r) => r.translTable) },
    { name: "source", type: "STRING", data: u.map((r) => r.source) },
    ...CODONS.map((c) => ({ name: c, type: "INT32" as const, data: u.map((r) => r.counts[c] ?? 0) })),
    ...AA_KEYS.map((a) => ({ name: a === "*" ? "aa_stop" : `aa_${a}`, type: "INT32" as const, data: u.map((r) => r.aminoAcids[a] ?? 0) })),
    ...provenanceColumns(u.map((r) => r.provenance)),
  ]);

  const gf: { id: number; key: string; f: GenomeFeature }[] = [];
  for (const [id, feats] of p.features) {
    const keys = featureKeys(feats);
    feats.forEach((f, i) => gf.push({ id, key: keys[i]!, f }));
  }
  await out("genome_features.parquet", [
    { name: "species_id", type: "INT32", data: gf.map((r) => r.id) },
    { name: "slug", type: "STRING", data: gf.map((r) => slugOf.get(r.id) ?? null) },
    { name: "feature_key", type: "STRING", data: gf.map((r) => r.key) },
    { name: "name", type: "STRING", data: gf.map((r) => r.f.name) },
    { name: "type", type: "STRING", data: gf.map((r) => r.f.type) },
    { name: "start", type: "INT32", data: gf.map((r) => r.f.start) },
    { name: "end", type: "INT32", data: gf.map((r) => r.f.end) },
    { name: "strand", type: "INT32", data: gf.map((r) => r.f.strand) },
    ...provenanceColumns(gf.map((r) => r.f.provenance)),
  ]);

  const o = p.observations;
  await out("lifespan_observations.parquet", [
    { name: "species_id", type: "INT32", data: o.map((r) => r.speciesId) },
    { name: "slug", type: "STRING", data: o.map((r) => slugOf.get(r.speciesId) ?? null) },
    { name: "ncbi_species_taxid", type: "INT32", data: o.map((r) => r.ncbiTaxid) },
    { name: "source", type: "STRING", data: o.map((r) => r.source) },
    { name: "source_record_id", type: "STRING", data: o.map((r) => r.sourceRecordId) },
    { name: "source_name", type: "STRING", data: o.map((r) => r.sourceName) },
    { name: "value_years", type: "DOUBLE", data: o.map((r) => r.valueYears) },
    { name: "record_type", type: "STRING", data: o.map((r) => r.recordType) },
    { name: "quality", type: "STRING", data: o.map((r) => r.quality) },
    { name: "sample_size_text", type: "STRING", data: o.map((r) => r.sampleSizeText) },
    { name: "sex", type: "STRING", data: o.map((r) => r.sex) },
    { name: "detail", type: "STRING", data: o.map((r) => r.detail) },
    { name: "reference", type: "STRING", data: o.map((r) => r.reference) },
    { name: "license", type: "STRING", data: o.map((r) => r.license) },
    { name: "match_method", type: "STRING", data: o.map((r) => r.matchMethod) },
    { name: "is_chosen", type: "BOOLEAN", data: o.map((r) => r.isChosen) },
    ...provenanceColumns(o.map((r) => r.provenance)),
  ]);

  const cl = p.changelog;
  await out("changelog.parquet", [
    { name: "build", type: "INT32", data: cl.map((c) => c.build) },
    { name: "changed_at", type: "STRING", data: cl.map((c) => c.changedAt) },
    { name: "table", type: "STRING", data: cl.map((c) => c.table) },
    { name: "row_key", type: "STRING", data: cl.map((c) => c.rowKey) },
    { name: "field", type: "STRING", data: cl.map((c) => c.field) },
    { name: "old_value", type: "STRING", data: cl.map((c) => c.oldValue) },
    { name: "new_value", type: "STRING", data: cl.map((c) => c.newValue) },
    { name: "change_type", type: "STRING", data: cl.map((c) => c.changeType) },
    { name: "diff_class", type: "STRING", data: cl.map((c) => c.diffClass) },
    { name: "reason", type: "STRING", data: cl.map((c) => c.reason) },
    { name: "upstream_source", type: "STRING", data: cl.map((c) => c.upstreamSource) },
    { name: "upstream_version", type: "STRING", data: cl.map((c) => c.upstreamVersion) },
    { name: "scope", type: "STRING", data: cl.map((c) => c.scope) },
  ]);

  const mtst = p.extended.structure;
  await out("mtdna_structure.parquet", [
    { name: "species_id", type: "INT32", data: mtst.map((r) => r.speciesId) },
    { name: "slug", type: "STRING", data: mtst.map((r) => slugOf.get(r.speciesId) ?? null) },
    { name: "orientation", type: "STRING", data: mtst.map((r) => r.orientation) },
    { name: "major_arc_start", type: "INT32", data: mtst.map((r) => r.majorArc?.start ?? null) },
    { name: "major_arc_end", type: "INT32", data: mtst.map((r) => r.majorArc?.end ?? null) },
    { name: "major_arc_bp", type: "INT32", data: mtst.map((r) => r.majorArc?.length ?? null) },
    { name: "control_regions", type: "INT32", data: mtst.map((r) => r.controlRegions) },
    { name: "repeat_min_length", type: "INT32", data: mtst.map(() => REPEAT_MIN_LENGTH) },
    { name: "direct_repeats_total", type: "INT32", data: mtst.map((r) => r.total?.direct ?? null) },
    { name: "inverted_repeats_total", type: "INT32", data: mtst.map((r) => r.total?.inverted ?? null) },
    { name: "mirror_repeats_total", type: "INT32", data: mtst.map((r) => r.total?.mirror ?? null) },
    { name: "longest_direct_repeat_total", type: "INT32", data: mtst.map((r) => r.total?.longestDirect ?? null) },
    { name: "direct_repeats_major_arc", type: "INT32", data: mtst.map((r) => r.major?.direct ?? null) },
    { name: "inverted_repeats_major_arc", type: "INT32", data: mtst.map((r) => r.major?.inverted ?? null) },
    { name: "mirror_repeats_major_arc", type: "INT32", data: mtst.map((r) => r.major?.mirror ?? null) },
    { name: "longest_direct_repeat_major_arc", type: "INT32", data: mtst.map((r) => r.major?.longestDirect ?? null) },
    { name: "contact_zone1_start", type: "INT32", data: mtst.map((r) => r.contactZones?.zone1.start ?? null) },
    { name: "contact_zone1_end", type: "INT32", data: mtst.map((r) => r.contactZones?.zone1.end ?? null) },
    { name: "contact_zone2_start", type: "INT32", data: mtst.map((r) => r.contactZones?.zone2.start ?? null) },
    { name: "contact_zone2_end", type: "INT32", data: mtst.map((r) => r.contactZones?.zone2.end ?? null) },
    { name: "contact_zone_direct_pairs", type: "INT32", data: mtst.map((r) => r.bridging?.direct ?? null) },
    { name: "contact_zone_inverted_pairs", type: "INT32", data: mtst.map((r) => r.bridging?.inverted ?? null) },
    { name: "contact_zone_mirror_pairs", type: "INT32", data: mtst.map((r) => r.bridging?.mirror ?? null) },
    ...MOTIF_COLUMNS.flatMap(([suffix, pick]): Column[] => [
      { name: `${suffix}_total`, type: "INT32", data: mtst.map((r) => (r.motifsTotal ? pick(r.motifsTotal) : null)) },
      { name: `${suffix}_major_arc`, type: "INT32", data: mtst.map((r) => (r.motifsMajorArc ? pick(r.motifsMajorArc) : null)) },
    ]),
  ]);

  const pgf = p.extended.genes;
  await out("protein_gene_features.parquet", [
    { name: "species_id", type: "INT32", data: pgf.map((r) => r.speciesId) },
    { name: "slug", type: "STRING", data: pgf.map((r) => slugOf.get(r.speciesId) ?? null) },
    { name: "region", type: "STRING", data: pgf.map((r) => r.region) },
    { name: "transl_table", type: "INT32", data: pgf.map((r) => r.translTable) },
    { name: "strand", type: "INT32", data: pgf.map((r) => r.strand) },
    { name: "ff_sites", type: "INT32", data: pgf.map((r) => r.fourfold.a + r.fourfold.c + r.fourfold.g + r.fourfold.u) },
    { name: "ff_a", type: "INT32", data: pgf.map((r) => r.fourfold.a) },
    { name: "ff_c", type: "INT32", data: pgf.map((r) => r.fourfold.c) },
    { name: "ff_g", type: "INT32", data: pgf.map((r) => r.fourfold.g) },
    { name: "ff_u", type: "INT32", data: pgf.map((r) => r.fourfold.u) },
    { name: "ffh_a", type: "INT32", data: pgf.map((r) => r.heavy?.a ?? null) },
    { name: "ffh_c", type: "INT32", data: pgf.map((r) => r.heavy?.c ?? null) },
    { name: "ffh_g", type: "INT32", data: pgf.map((r) => r.heavy?.g ?? null) },
    { name: "ffh_t", type: "INT32", data: pgf.map((r) => r.heavy?.t ?? null) },
    { name: "gravy", type: "DOUBLE", data: pgf.map((r) => (r.gravy === null ? null : round(r.gravy, 6))) },
  ]);

  const rv = p.review;
  const rcols = ["review_type", "ncbi_taxid", "scientific_name", "refseq", "source", "source_name", "detail"];
  sizes["review_list.csv"] = await write(
    join(PUBLIC_DATA_DIR, "review_list.csv"),
    toCsv(rcols, rv.map((r) => [r.reviewType, r.ncbiTaxid, r.scientificName, r.refseq, r.source, r.sourceName, r.detail])),
  );
  sizes["README.md"] = await write(join(PUBLIC_DATA_DIR, "README.md"), readme);
  return sizes;
}
