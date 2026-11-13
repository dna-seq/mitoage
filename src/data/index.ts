/**
 * Data access for pages and components. Implements DataApi from ./schema.
 *
 * Reads the pipeline's committed output at build time: the parquet downloads in public/data/
 * (species, region_stats, codon_usage, genome_features; decision D3) with hyparquet, and the small
 * JSON in src/data/generated/ (build-info, taxonomy, phylogeny). Derived tables are computed here,
 * lazily and memoised, instead of being committed: feature definitions and values, and the
 * correlations (both datasets, PIC on the committed dated tree). The parquet files are loaded once
 * with a top-level await; every DataApi function stays synchronous, so it works in Astro
 * frontmatter and getStaticPaths. Server-side only: islands receive data as props or fetch
 * /data/explorer.json.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Row, readParquet } from "../../pipeline/lib/parquet";
import { type PhyloNode, compileTree } from "../../pipeline/lib/stats";
import { computeCorrelations } from "../../pipeline/steps/correlations";
import { buildFeatureDefs, buildFeatureValues } from "../../pipeline/steps/features";
import { AMINO_ACIDS, CODONS } from "../../pipeline/lib/genetic-code";
import {
  CORRELATION_DATASETS,
  type BuildInfo,
  type CodonUsage,
  type Correlation,
  type CorrelationDataset,
  type DataApi,
  type FeatureDef,
  type FeatureType,
  type GenomeFeature,
  type LifespanInfo,
  type Rank,
  type RecordStatus,
  type Region,
  type RegionStats,
  type RowProvenance,
  type Species,
  type TaxonNode,
  type TraitKey,
} from "./schema";

export * from "./schema";

// ---------------------------------------------------------------- file locations

function resolveDir(rel: string[], marker: string): string {
  const candidates: string[] = [];
  try {
    candidates.push(fileURLToPath(new URL(`./${rel.join("/")}/`, new URL("../../", import.meta.url))));
  } catch {
    // import.meta.url may not be a file: URL once bundled.
  }
  const cwd = typeof process !== "undefined" ? process.cwd() : ".";
  candidates.push(join(cwd, ...rel));
  for (const c of candidates) if (existsSync(join(c, marker))) return c;
  throw new Error(`MitoAge data not found (looked for ${marker} in ${candidates.join(", ")}). Run \`bun run data\`.`);
}

const GENERATED_DIR = resolveDir(["src", "data", "generated"], "build-info.json");
const PUBLIC_DIR = resolveDir(["public", "data"], "species.parquet");

const jsonCache = new Map<string, unknown>();
function load<T>(file: string): T {
  if (!jsonCache.has(file)) jsonCache.set(file, JSON.parse(readFileSync(join(GENERATED_DIR, file), "utf8")));
  return jsonCache.get(file) as T;
}

function memo<T>(fn: () => T): () => T {
  let done = false;
  let value: T;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value;
  };
}

// ---------------------------------------------------------------- parquet tables (loaded once)

const [speciesRows, statsRows, codonRows, featureRows] = await Promise.all(
  ["species", "region_stats", "codon_usage", "genome_features"].map((t) => readParquet(join(PUBLIC_DIR, `${t}.parquet`))),
) as [Row[], Row[], Row[], Row[]];

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const list = (v: unknown): string[] => (v === null || v === undefined || v === "" ? [] : String(v).split("; "));

function provenanceOf(r: Row): RowProvenance | undefined {
  if (r["record_status"] === undefined || r["record_status"] === null) return undefined;
  return {
    addedInBuild: num(r["added_in_build"]),
    addedAt: str(r["added_at"]),
    lastModifiedBuild: numOrNull(r["last_modified_build"]),
    lastModifiedAt: strOrNull(r["last_modified_at"]),
    recordStatus: str(r["record_status"]) as RecordStatus,
    sourceVersion: str(r["source_version"]),
  };
}

function speciesOf(r: Row): Species {
  const s: Species = {
    id: num(r["id"]),
    slug: str(r["slug"]),
    refseq: str(r["refseq"]),
    scientificName: str(r["scientific_name"]),
    commonName: str(r["common_name"]),
    taxonomy: {
      kingdom: str(r["kingdom"]), phylum: str(r["phylum"]), class: str(r["class"]),
      order: str(r["order"]), family: str(r["family"]), genus: str(r["genus"]),
    },
    maxLongevityYears: num(r["max_longevity_years"]),
    mtdnaSizeBp: num(r["mtdna_size_bp"]),
    nonCodingBp: numOrNull(r["non_coding_bp"]),
    gcPercent: num(r["gc_percent"]),
    traits: {
      adultWeightG: numOrNull(r["adult_weight_g"]),
      birthWeightG: numOrNull(r["birth_weight_g"]),
      metabolicRateW: numOrNull(r["metabolic_rate_w"]),
      bodyTemperatureK: numOrNull(r["body_temperature_k"]),
      femaleMaturityDays: numOrNull(r["female_maturity_days"]),
      maleMaturityDays: numOrNull(r["male_maturity_days"]),
      gestationDays: numOrNull(r["gestation_days"]),
      litterSize: numOrNull(r["litter_size"]),
      littersPerYear: numOrNull(r["litters_per_year"]),
      growthRatePerDay: numOrNull(r["growth_rate_per_day"]),
      source: strOrNull(r["traits_source"]),
    },
    legacyId: numOrNull(r["legacy_id"]),
    ncbiTaxid: numOrNull(r["ncbi_taxid"]),
    ncbiSpeciesTaxid: numOrNull(r["ncbi_species_taxid"]),
    previousScientificNames: list(r["previous_scientific_names"]),
    retiredReason: strOrNull(r["retired_reason"]),
    reviewFlags: list(r["review_flags"]),
    changeKinds: list(r["change_kinds"]),
  };
  const p = provenanceOf(r);
  if (p) s.provenance = p;
  if (r["lifespan_source"] !== null && r["lifespan_source"] !== undefined) {
    s.lifespan = {
      source: str(r["lifespan_source"]) as LifespanInfo["source"],
      sourceVersion: str(r["lifespan_source_version"]),
      sourceRecordId: str(r["lifespan_source_record_id"]),
      quality: strOrNull(r["lifespan_quality"]) as LifespanInfo["quality"],
      sampleSize: strOrNull(r["lifespan_sample_size"]),
      recordType: str(r["lifespan_record_type"]) as LifespanInfo["recordType"],
      license: str(r["lifespan_license"]),
    };
  }
  return s;
}

// ---------------------------------------------------------------- species & taxonomy

const speciesList = memo(() => speciesRows.map(speciesOf));
const speciesBySlug = memo(() => new Map(speciesList().map((s) => [s.slug, s])));
const speciesById = memo(() => new Map(speciesList().map((s) => [s.id, s])));

export function getBuildInfo(): BuildInfo {
  return load<BuildInfo>("build-info.json");
}

export function getAllSpecies(): Species[] {
  return speciesList();
}

export function getSpeciesBySlug(slug: string): Species | undefined {
  return speciesBySlug().get(slug);
}

export function getSpeciesById(id: number): Species | undefined {
  return speciesById().get(id);
}

export function getTaxonomyTree(): TaxonNode {
  return load<TaxonNode>("taxonomy.json");
}

const taxaList = memo(() => {
  const out: TaxonNode[] = [];
  const walk = (n: TaxonNode) => {
    if (n.rank === "species") return;
    out.push(n);
    n.children.forEach(walk);
  };
  walk(getTaxonomyTree());
  return out;
});
const taxonIndex = memo(() => new Map(taxaList().map((t) => [`${t.rank}:${t.slug}`, t])));

export function getTaxa(): TaxonNode[] {
  return taxaList();
}

export function getTaxon(rank: Rank, slug: string): TaxonNode | undefined {
  if (rank === "species") {
    const s = getSpeciesBySlug(slug);
    return s ? { name: s.scientificName, rank: "species", slug: s.slug, speciesCount: 1, children: [], speciesId: s.id } : undefined;
  }
  return taxonIndex().get(`${rank}:${slug}`);
}

const speciesInTaxonCache = new Map<string, Species[]>();
export function getSpeciesInTaxon(rank: Rank, slug: string): Species[] {
  const key = `${rank}:${slug}`;
  const hit = speciesInTaxonCache.get(key);
  if (hit) return hit;
  const node = getTaxon(rank, slug);
  const out: Species[] = [];
  const walk = (n: TaxonNode) => {
    if (n.speciesId !== undefined) {
      const s = getSpeciesById(n.speciesId);
      if (s) out.push(s);
    }
    n.children.forEach(walk);
  };
  if (node) walk(node);
  speciesInTaxonCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------- region stats

const regionStats = memo(() => {
  const rows: RegionStats[] = statsRows.map((r) => {
    const s: RegionStats = {
      speciesId: num(r["species_id"]),
      region: str(r["region"]) as Region,
      lengthBp: num(r["length_bp"]),
      a: num(r["a"]),
      c: num(r["c"]),
      g: num(r["g"]),
      t: num(r["t"]),
      other: num(r["other"]),
      gcPercent: num(r["gc_percent"]),
      gcSkew: numOrNull(r["gc_skew"]),
      atSkew: numOrNull(r["at_skew"]),
      source: str(r["source"]) === "genbank" ? "genbank" : "mitoage",
    };
    const p = provenanceOf(r);
    if (p) s.provenance = p;
    return s;
  });
  const bySpecies = new Map<number, RegionStats[]>();
  const byRegion = new Map<Region, RegionStats[]>();
  for (const r of rows) {
    (bySpecies.get(r.speciesId) ?? bySpecies.set(r.speciesId, []).get(r.speciesId)!).push(r);
    (byRegion.get(r.region) ?? byRegion.set(r.region, []).get(r.region)!).push(r);
  }
  return { rows, bySpecies, byRegion };
});

export function getRegionStats(speciesId: number): RegionStats[] {
  return regionStats().bySpecies.get(speciesId) ?? [];
}

export function getRegionStatsForRegion(region: Region): RegionStats[] {
  return regionStats().byRegion.get(region) ?? [];
}

// ---------------------------------------------------------------- codon usage

type UsageRow = CodonUsage & { translTable: number };
const AA_KEYS = [...AMINO_ACIDS, "*"];
const codonUsage = memo(() => {
  const rows: UsageRow[] = codonRows.map((r) => {
    const counts: Record<string, number> = {};
    for (const c of CODONS) counts[c] = num(r[c]);
    const aminoAcids: Record<string, number> = {};
    for (const a of AA_KEYS) aminoAcids[a] = num(r[a === "*" ? "aa_stop" : `aa_${a}`]);
    const u: UsageRow = {
      speciesId: num(r["species_id"]),
      region: str(r["region"]) as CodonUsage["region"],
      counts,
      aminoAcids,
      translTable: num(r["transl_table"]),
    };
    const p = provenanceOf(r);
    if (p) u.provenance = p;
    return u;
  });
  const bySpecies = new Map<number, UsageRow[]>();
  for (const u of rows) (bySpecies.get(u.speciesId) ?? bySpecies.set(u.speciesId, []).get(u.speciesId)!).push(u);
  return { rows, bySpecies };
});

export function getCodonUsage(speciesId: number): CodonUsage[] {
  return codonUsage().bySpecies.get(speciesId) ?? [];
}

// ---------------------------------------------------------------- genome features

const genomeFeatures = memo(() => {
  const by = new Map<number, GenomeFeature[]>();
  for (const r of featureRows) {
    const f: GenomeFeature = {
      name: str(r["name"]),
      type: str(r["type"]) as FeatureType,
      start: num(r["start"]),
      end: num(r["end"]),
      strand: num(r["strand"]) === -1 ? -1 : 1,
    };
    const p = provenanceOf(r);
    if (p) f.provenance = p;
    const id = num(r["species_id"]);
    (by.get(id) ?? by.set(id, []).get(id)!).push(f);
  }
  return by;
});

export function getGenomeFeatures(speciesId: number): GenomeFeature[] {
  return genomeFeatures().get(speciesId) ?? [];
}

// ---------------------------------------------------------------- derived: features & correlations

export const getFeatureDefs = memo((): FeatureDef[] => buildFeatureDefs());

/**
 * Feature values aligned with getAllSpecies(). A retired row of a species that is not retired (a
 * region its new RefSeq record no longer annotates) does not feed the values.
 */
export const getFeatureValueArrays = memo(() => {
  const species = getAllSpecies();
  const ids = species.map((s) => s.id);
  const retired = new Set(species.filter((s) => s.provenance?.recordStatus === "retired").map((s) => s.id));
  const current = <T extends { speciesId: number; provenance?: RowProvenance }>(r: T) =>
    r.provenance?.recordStatus !== "retired" || retired.has(r.speciesId);
  const values = buildFeatureValues(
    getFeatureDefs(),
    ids,
    regionStats().rows.filter(current),
    codonUsage().rows.filter(current),
    new Map(species.map((s) => [s.id, s.nonCodingBp])),
  );
  return { speciesIds: ids, values };
});

const featureValueCache = new Map<string, Record<number, number | null>>();
export function getFeatureValues(featureKey: string): Record<number, number | null> {
  const hit = featureValueCache.get(featureKey);
  if (hit) return hit;
  const { speciesIds, values } = getFeatureValueArrays();
  const arr = values.get(featureKey);
  const out: Record<number, number | null> = {};
  if (arr) speciesIds.forEach((id, i) => (out[id] = arr[i] ?? null));
  featureValueCache.set(featureKey, out);
  return out;
}

/** The dated tree used for PIC (null when the build has none: PIC values are then unknown). */
export const getPhylogeny = memo(() => load<{ version: string; root: PhyloNode } | null>("phylogeny.json"));

const correlations = memo(() => {
  const species = getAllSpecies();
  const { values } = getFeatureValueArrays();
  const indexOf = new Map(species.map((s, i) => [s.id, i]));
  const phylo = getPhylogeny();
  const tree = phylo ? compileTree(phylo.root, (leaf) => indexOf.get(leaf)) : null;
  const rows: Correlation[] = [];
  for (const d of CORRELATION_DATASETS) rows.push(...computeCorrelations(species, getFeatureDefs(), values, tree, d).rows);
  const byFeature = new Map<string, Correlation[]>();
  const byScopeTrait = new Map<string, Correlation[]>();
  for (const r of rows) {
    const k = `${r.dataset ?? "default"}|${r.featureKey}`;
    (byFeature.get(k) ?? byFeature.set(k, []).get(k)!).push(r);
    const k2 = `${r.dataset ?? "default"}|${r.scope}|${r.trait}`;
    (byScopeTrait.get(k2) ?? byScopeTrait.set(k2, []).get(k2)!).push(r);
  }
  return { rows, byFeature, byScopeTrait };
});

/** Every correlation row of every dataset (for the correlations.parquet download). */
export const getAllCorrelationRows = () => correlations().rows;

export function getCorrelations(filter?: { featureKey?: string; trait?: TraitKey; scope?: string; dataset?: CorrelationDataset }): Correlation[] {
  const idx = correlations();
  const d: CorrelationDataset = filter?.dataset ?? "default";
  let base: Correlation[];
  if (filter?.featureKey) base = idx.byFeature.get(`${d}|${filter.featureKey}`) ?? [];
  else if (filter?.scope && filter?.trait) base = idx.byScopeTrait.get(`${d}|${filter.scope}|${filter.trait}`) ?? [];
  else base = idx.rows.filter((r) => (r.dataset ?? "default") === d);
  return base.filter(
    (r) =>
      (filter?.featureKey === undefined || r.featureKey === filter.featureKey) &&
      (filter?.trait === undefined || r.trait === filter.trait) &&
      (filter?.scope === undefined || r.scope === filter.scope),
  );
}

/** Compile-time check that this module implements the whole DataApi. */
const api: DataApi = {
  getBuildInfo,
  getAllSpecies,
  getSpeciesBySlug,
  getSpeciesById,
  getTaxonomyTree,
  getTaxa,
  getTaxon,
  getSpeciesInTaxon,
  getRegionStats,
  getRegionStatsForRegion,
  getCodonUsage,
  getGenomeFeatures,
  getFeatureDefs,
  getFeatureValues,
  getCorrelations,
};
export default api;
