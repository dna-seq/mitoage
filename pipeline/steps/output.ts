/**
 * Writers for the committed pipeline output.
 *
 * src/data/generated/: small JSON the site reads directly (build-info, taxonomy tree, dated
 * phylogeny). public/data/: the parquet downloads, which are also the site's data source (the
 * data layer reads them at build time, decision D3); derived tables (feature values, correlations,
 * explorer.json) are computed during the site build and are not committed.
 */
import { mkdirSync, rmSync } from "node:fs";
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
import type { PhyloNode } from "../lib/stats";
import { featureKeys } from "./diff";

export const GENERATED_DIR = join(ROOT, "src", "data", "generated");
export const PUBLIC_DATA_DIR = join(ROOT, "public", "data");

type Usage = CodonUsage & { source: "mitoage" | "genbank"; translTable: number };

const json = (v: unknown) => JSON.stringify(v);

async function write(path: string, content: string): Promise<number> {
  await Bun.write(path, content);
  return Buffer.byteLength(content);
}

export function resetDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
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
  resetDir(GENERATED_DIR);
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

export interface PublicPayload {
  species: Species[];
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
    col("change_kinds", "STRING", (s) => list(s.changeKinds)),
    ...provenanceColumns(species.map((s) => s.provenance)),
  ];
}

export async function writePublic(p: PublicPayload, readme: string): Promise<Record<string, number>> {
  resetDir(PUBLIC_DATA_DIR);
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

  const rv = p.review;
  const rcols = ["review_type", "ncbi_taxid", "scientific_name", "refseq", "source", "source_name", "detail"];
  sizes["review_list.csv"] = await write(
    join(PUBLIC_DATA_DIR, "review_list.csv"),
    toCsv(rcols, rv.map((r) => [r.reviewType, r.ncbiTaxid, r.scientificName, r.refseq, r.source, r.sourceName, r.detail])),
  );
  sizes["README.md"] = await write(join(PUBLIC_DATA_DIR, "README.md"), readme);
  return sizes;
}
