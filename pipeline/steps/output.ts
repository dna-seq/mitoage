/** Writers for generated JSON (site build), Parquet/CSV downloads and the explorer payload. */
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parquetWriteFile } from "hyparquet-writer";
import type {
  BuildInfo,
  Correlation,
  FeatureDef,
  GenomeFeature,
  Region,
  RegionStats,
  Species,
  TaxonNode,
} from "../../src/data/schema";
import { ROOT } from "../lib/cache";
import { toCsv } from "../lib/csv";
import { AMINO_ACIDS, CODONS } from "../lib/genetic-code";
import { round, roundSig } from "../lib/stats";
import type { buildCodonUsage } from "./regions";
import { TRAIT_KEYS, traitValue } from "./correlations";

export const GENERATED_DIR = join(ROOT, "src", "data", "generated");
export const PUBLIC_DATA_DIR = join(ROOT, "public", "data");

type Usage = ReturnType<typeof buildCodonUsage>["usage"];

const json = (v: unknown) => JSON.stringify(v);

async function write(path: string, content: string): Promise<number> {
  await Bun.write(path, content);
  return content.length;
}

export function resetDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

const AA_KEYS = [...AMINO_ACIDS, "*"];

export interface GeneratedPayload {
  buildInfo: BuildInfo;
  species: Species[];
  taxonomy: TaxonNode;
  stats: RegionStats[];
  usage: Usage;
  features: Map<number, GenomeFeature[]>;
  defs: FeatureDef[];
  values: Map<string, (number | null)[]>;
  speciesIds: number[];
  correlations: Correlation[];
}

/** src/data/generated/*.json, consumed by src/data/index.ts. Returns file sizes. */
export async function writeGenerated(p: GeneratedPayload): Promise<Record<string, number>> {
  resetDir(GENERATED_DIR);
  const sizes: Record<string, number> = {};
  const w = async (name: string, v: unknown) => {
    sizes[name] = await write(join(GENERATED_DIR, name), json(v));
  };
  await w("build-info.json", p.buildInfo);
  await w("species.json", p.species);
  await w("taxonomy.json", p.taxonomy);

  const regions = [...new Set(p.stats.map((s) => s.region))] as Region[];
  const rIdx = new Map(regions.map((r, i) => [r, i]));
  await w("region-stats.json", {
    regions,
    sources: ["mitoage", "genbank"],
    columns: {
      speciesId: p.stats.map((s) => s.speciesId),
      region: p.stats.map((s) => rIdx.get(s.region)!),
      lengthBp: p.stats.map((s) => s.lengthBp),
      a: p.stats.map((s) => s.a),
      c: p.stats.map((s) => s.c),
      g: p.stats.map((s) => s.g),
      t: p.stats.map((s) => s.t),
      other: p.stats.map((s) => s.other),
      gcPercent: p.stats.map((s) => s.gcPercent),
      gcSkew: p.stats.map((s) => s.gcSkew),
      atSkew: p.stats.map((s) => s.atSkew),
      source: p.stats.map((s) => (s.source === "genbank" ? 1 : 0)),
    },
  });

  const cRegions = [...new Set(p.usage.map((u) => u.region))];
  const cIdx = new Map(cRegions.map((r, i) => [r, i]));
  await w("codon-usage.json", {
    codons: CODONS,
    aminoAcids: AA_KEYS,
    regions: cRegions,
    sources: ["mitoage", "genbank"],
    rows: {
      speciesId: p.usage.map((u) => u.speciesId),
      region: p.usage.map((u) => cIdx.get(u.region)!),
      translTable: p.usage.map((u) => u.translTable),
      source: p.usage.map((u) => (u.source === "genbank" ? 1 : 0)),
    },
    counts: p.usage.map((u) => CODONS.map((c) => u.counts[c] ?? 0)),
    aminoAcidCounts: p.usage.map((u) => AA_KEYS.map((a) => u.aminoAcids[a] ?? 0)),
  });

  const names: string[] = [];
  const nIdx = new Map<string, number>();
  const types = ["CDS", "rRNA", "tRNA", "D-loop"] as const;
  const bySpecies: Record<string, number[]> = {};
  for (const [id, feats] of p.features) {
    const flat: number[] = [];
    for (const f of feats) {
      if (!nIdx.has(f.name)) {
        nIdx.set(f.name, names.length);
        names.push(f.name);
      }
      flat.push(nIdx.get(f.name)!, types.indexOf(f.type), f.start, f.end, f.strand);
    }
    bySpecies[id] = flat;
  }
  await w("genome-features.json", { names, types, stride: 5, bySpecies });
  await w("feature-defs.json", p.defs);
  await w("feature-values.json", {
    speciesIds: p.speciesIds,
    values: Object.fromEntries(p.defs.map((d) => [d.key, p.values.get(d.key)])),
  });

  const fKeys = [...new Set(p.correlations.map((c) => c.featureKey))];
  const tKeys = [...new Set(p.correlations.map((c) => c.trait))];
  const sKeys = [...new Set(p.correlations.map((c) => c.scope))];
  const fI = new Map(fKeys.map((k, i) => [k, i]));
  const tI = new Map(tKeys.map((k, i) => [k, i]));
  const sI = new Map(sKeys.map((k, i) => [k, i]));
  const r4 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : round(v, 4));
  const p3 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : roundSig(v, 3));
  const cs = p.correlations;
  await w("correlations.json", {
    features: fKeys,
    traits: tKeys,
    scopes: sKeys,
    columns: {
      feature: cs.map((c) => fI.get(c.featureKey)!),
      trait: cs.map((c) => tI.get(c.trait)!),
      scope: cs.map((c) => sI.get(c.scope)!),
      n: cs.map((c) => c.n),
      pearsonR: cs.map((c) => r4(c.pearsonR)),
      spearmanRho: cs.map((c) => r4(c.spearmanRho)),
      pValue: cs.map((c) => p3(c.pValue)),
      qValue: cs.map((c) => p3(c.qValue)),
      picR: cs.map((c) => r4(c.picR)),
      picPValue: cs.map((c) => p3(c.picPValue)),
      partialR: cs.map((c) => r4(c.partialR)),
      partialPValue: cs.map((c) => p3(c.partialPValue)),
      partialN: cs.map((c) => c.partialN ?? null),
    },
  });
  return sizes;
}

// ---------------- public/data downloads ----------------

export interface PublicExtras {
  /** Extra per-species columns for the downloads (AnAge 15 longevity, match info, NCBI taxon). */
  extra: Map<
    number,
    { anageHagrid: string | null; anageMatch: string; anageMaxLongevityYears: number | null; ncbiTaxid: number | null; translTable: number }
  >;
}

const SPECIES_COLUMNS = [
  "id", "slug", "scientific_name", "common_name", "refseq", "kingdom", "phylum", "class", "order", "family", "genus",
  "max_longevity_years", "mtdna_size_bp", "non_coding_bp", "gc_percent", "legacy_id",
  "adult_weight_g", "birth_weight_g", "metabolic_rate_w", "body_temperature_k", "female_maturity_days",
  "male_maturity_days", "gestation_days", "litter_size", "litters_per_year", "growth_rate_per_day",
  "traits_source", "anage_build15_hagrid", "anage_match", "anage_build15_max_longevity_years", "ncbi_taxid", "transl_table",
] as const;

function speciesRows(species: Species[], x: PublicExtras): unknown[][] {
  return species.map((s) => {
    const e = x.extra.get(s.id);
    const t = s.traits;
    return [
      s.id, s.slug, s.scientificName, s.commonName, s.refseq, s.taxonomy.kingdom, s.taxonomy.phylum, s.taxonomy.class,
      s.taxonomy.order, s.taxonomy.family, s.taxonomy.genus, s.maxLongevityYears, s.mtdnaSizeBp, s.nonCodingBp,
      s.gcPercent, s.legacyId, t.adultWeightG, t.birthWeightG, t.metabolicRateW, t.bodyTemperatureK,
      t.femaleMaturityDays, t.maleMaturityDays, t.gestationDays, t.litterSize, t.littersPerYear, t.growthRatePerDay,
      t.source, e?.anageHagrid ?? null, e?.anageMatch ?? "none", e?.anageMaxLongevityYears ?? null, e?.ncbiTaxid ?? null,
      e?.translTable ?? null,
    ];
  });
}

const INT_COLS = new Set(["id", "mtdna_size_bp", "non_coding_bp", "legacy_id", "ncbi_taxid", "transl_table"]);
const STRING_COLS = new Set([
  "slug", "scientific_name", "common_name", "refseq", "kingdom", "phylum", "class", "order", "family", "genus",
  "traits_source", "anage_build15_hagrid", "anage_match",
]);

type ColType = "INT32" | "DOUBLE" | "STRING";
function parquet(path: string, cols: { name: string; type: ColType; data: unknown[] }[]): void {
  parquetWriteFile({
    filename: path,
    columnData: cols.map((c) => ({ name: c.name, type: c.type, data: c.data as never })),
  });
}

export async function writePublic(
  p: GeneratedPayload,
  x: PublicExtras,
  explorer: unknown,
  readme: string,
): Promise<Record<string, number>> {
  resetDir(PUBLIC_DATA_DIR);
  const sizes: Record<string, number> = {};
  const slugOf = new Map(p.species.map((s) => [s.id, s.slug]));

  // species
  const rows = speciesRows(p.species, x);
  sizes["species.csv"] = await write(join(PUBLIC_DATA_DIR, "species.csv"), toCsv([...SPECIES_COLUMNS], rows));
  parquet(
    join(PUBLIC_DATA_DIR, "species.parquet"),
    SPECIES_COLUMNS.map((name, i) => ({
      name,
      type: INT_COLS.has(name) ? "INT32" : STRING_COLS.has(name) ? "STRING" : "DOUBLE",
      data: rows.map((r) => r[i] ?? null),
    })),
  );

  // region stats
  const st = p.stats;
  parquet(join(PUBLIC_DATA_DIR, "region_stats.parquet"), [
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
  ]);

  // codon usage (wide: one column per codon, plus amino-acid counts)
  const u = p.usage;
  parquet(join(PUBLIC_DATA_DIR, "codon_usage.parquet"), [
    { name: "species_id", type: "INT32", data: u.map((r) => r.speciesId) },
    { name: "slug", type: "STRING", data: u.map((r) => slugOf.get(r.speciesId) ?? null) },
    { name: "region", type: "STRING", data: u.map((r) => r.region) },
    { name: "transl_table", type: "INT32", data: u.map((r) => r.translTable) },
    { name: "source", type: "STRING", data: u.map((r) => r.source) },
    ...CODONS.map((c) => ({ name: c, type: "INT32" as const, data: u.map((r) => r.counts[c] ?? 0) })),
    ...AA_KEYS.map((a) => ({
      name: a === "*" ? "aa_stop" : `aa_${a}`,
      type: "INT32" as const,
      data: u.map((r) => r.aminoAcids[a] ?? 0),
    })),
  ]);

  // genome features
  const gf: { id: number; f: GenomeFeature }[] = [];
  for (const [id, feats] of p.features) for (const f of feats) gf.push({ id, f });
  parquet(join(PUBLIC_DATA_DIR, "genome_features.parquet"), [
    { name: "species_id", type: "INT32", data: gf.map((r) => r.id) },
    { name: "slug", type: "STRING", data: gf.map((r) => slugOf.get(r.id) ?? null) },
    { name: "name", type: "STRING", data: gf.map((r) => r.f.name) },
    { name: "type", type: "STRING", data: gf.map((r) => r.f.type) },
    { name: "start", type: "INT32", data: gf.map((r) => r.f.start) },
    { name: "end", type: "INT32", data: gf.map((r) => r.f.end) },
    { name: "strand", type: "INT32", data: gf.map((r) => r.f.strand) },
  ]);

  // correlations
  const cs = p.correlations;
  const n = (v: number | null | undefined) => (v === undefined || v === null || !Number.isFinite(v) ? null : v);
  parquet(join(PUBLIC_DATA_DIR, "correlations.parquet"), [
    { name: "feature_key", type: "STRING", data: cs.map((c) => c.featureKey) },
    { name: "trait", type: "STRING", data: cs.map((c) => c.trait) },
    { name: "scope", type: "STRING", data: cs.map((c) => c.scope) },
    { name: "n", type: "INT32", data: cs.map((c) => c.n) },
    { name: "pearson_r", type: "DOUBLE", data: cs.map((c) => n(c.pearsonR)) },
    { name: "spearman_rho", type: "DOUBLE", data: cs.map((c) => n(c.spearmanRho)) },
    { name: "p_value", type: "DOUBLE", data: cs.map((c) => n(c.pValue)) },
    { name: "q_value", type: "DOUBLE", data: cs.map((c) => n(c.qValue)) },
    { name: "partial_r", type: "DOUBLE", data: cs.map((c) => n(c.partialR)) },
    { name: "partial_p_value", type: "DOUBLE", data: cs.map((c) => n(c.partialPValue)) },
    { name: "partial_n", type: "INT32", data: cs.map((c) => c.partialN ?? null) },
    { name: "pic_r", type: "DOUBLE", data: cs.map((c) => n(c.picR)) },
    { name: "pic_p_value", type: "DOUBLE", data: cs.map((c) => n(c.picPValue)) },
  ]);

  sizes["explorer.json"] = await write(join(PUBLIC_DATA_DIR, "explorer.json"), json(explorer));
  sizes["README.md"] = await write(join(PUBLIC_DATA_DIR, "README.md"), readme);
  for (const f of ["species", "region_stats", "codon_usage", "genome_features", "correlations"]) {
    sizes[`${f}.parquet`] = Bun.file(join(PUBLIC_DATA_DIR, `${f}.parquet`)).size;
  }
  return sizes;
}

/** Columnar payload for the in-browser scatter explorer. */
export function buildExplorer(
  species: Species[],
  defs: FeatureDef[],
  values: Map<string, (number | null)[]>,
  buildInfo: BuildInfo,
): unknown {
  const classes = [...new Set(species.map((s) => s.taxonomy.class))].sort();
  const orders = [...new Set(species.map((s) => s.taxonomy.order))].sort();
  const families = [...new Set(species.map((s) => s.taxonomy.family))].sort();
  const keep = defs.filter((d) => !/^(codon|aa):/.test(d.key) || d.key.includes(":total_pc:"));
  const sig = (v: number | null) => (v === null ? null : Math.abs(v) >= 1000 ? Math.round(v) : roundSig(v, 4));
  return {
    build: buildInfo.build,
    generatedAt: buildInfo.generatedAt,
    n: species.length,
    classes,
    orders,
    families,
    species: {
      id: species.map((s) => s.id),
      slug: species.map((s) => s.slug),
      scientificName: species.map((s) => s.scientificName),
      commonName: species.map((s) => s.commonName),
      class: species.map((s) => classes.indexOf(s.taxonomy.class)),
      order: species.map((s) => orders.indexOf(s.taxonomy.order)),
      family: species.map((s) => families.indexOf(s.taxonomy.family)),
    },
    traits: Object.fromEntries(TRAIT_KEYS.map((t) => [t, species.map((s) => sig(traitValue(s, t)))])),
    features: keep.map((d) => ({ key: d.key, label: d.label, region: d.region, group: d.group })),
    values: Object.fromEntries(keep.map((d) => [d.key, (values.get(d.key) ?? []).map(sig)])),
  };
}
