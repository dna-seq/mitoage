/**
 * Data access for pages and components. Implements DataApi from ./schema.
 *
 * Reads the JSON written by the pipeline (src/data/generated/) synchronously with node:fs,
 * lazily and memoised: a file is parsed the first time a function needing it is called.
 * This works in `astro dev`, `astro build` (prerendering) and Bun scripts. It is server-side
 * only: client islands should receive data as props, or fetch /data/explorer.json.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BuildInfo,
  CodonUsage,
  Correlation,
  DataApi,
  FeatureDef,
  FeatureType,
  GenomeFeature,
  ProteinGene,
  Rank,
  Region,
  RegionStats,
  Species,
  TaxonNode,
  TraitKey,
} from "./schema";

export * from "./schema";

// ---------------------------------------------------------------- file loading

let generatedDir: string | undefined;

function resolveGeneratedDir(): string {
  if (generatedDir) return generatedDir;
  const candidates: string[] = [];
  try {
    candidates.push(fileURLToPath(new URL("./generated/", import.meta.url)));
  } catch {
    // import.meta.url may not be a file: URL once bundled.
  }
  const cwd = typeof process !== "undefined" ? process.cwd() : ".";
  candidates.push(join(cwd, "src", "data", "generated"));
  for (const c of candidates) {
    if (existsSync(join(c, "build-info.json"))) return (generatedDir = c);
  }
  throw new Error(`MitoAge generated data not found (looked in ${candidates.join(", ")}). Run \`bun run data\`.`);
}

const cache = new Map<string, unknown>();
function load<T>(file: string): T {
  if (!cache.has(file)) cache.set(file, JSON.parse(readFileSync(join(resolveGeneratedDir(), file), "utf8")));
  return cache.get(file) as T;
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

// ---------------------------------------------------------------- raw shapes

interface RegionStatsFile {
  regions: Region[];
  sources: ("mitoage" | "genbank")[];
  columns: {
    speciesId: number[];
    region: number[];
    lengthBp: number[];
    a: number[];
    c: number[];
    g: number[];
    t: number[];
    other: number[];
    gcPercent: number[];
    gcSkew: (number | null)[];
    atSkew: (number | null)[];
    source: number[];
  };
}

interface CodonUsageFile {
  codons: string[];
  aminoAcids: string[];
  regions: (ProteinGene | "total_pc")[];
  sources: string[];
  rows: { speciesId: number[]; region: number[]; translTable: number[]; source: number[] };
  counts: number[][];
  aminoAcidCounts: number[][];
}

interface GenomeFeaturesFile {
  names: string[];
  types: FeatureType[];
  stride: number;
  bySpecies: Record<string, number[]>;
}

interface FeatureValuesFile {
  speciesIds: number[];
  values: Record<string, (number | null)[]>;
}

type Nullable = number | null;
interface CorrelationsFile {
  features: string[];
  traits: TraitKey[];
  scopes: string[];
  columns: {
    feature: number[];
    trait: number[];
    scope: number[];
    n: number[];
    pearsonR: Nullable[];
    spearmanRho: Nullable[];
    pValue: Nullable[];
    qValue: Nullable[];
    picR: Nullable[];
    picPValue: Nullable[];
    partialR: Nullable[];
    partialPValue: Nullable[];
    partialN: Nullable[];
  };
}

// ---------------------------------------------------------------- species & taxonomy

const speciesList = memo(() => load<Species[]>("species.json"));
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
  const f = load<RegionStatsFile>("region-stats.json");
  const c = f.columns;
  const rows: RegionStats[] = c.speciesId.map((speciesId, i) => ({
    speciesId,
    region: f.regions[c.region[i]!]!,
    lengthBp: c.lengthBp[i]!,
    a: c.a[i]!,
    c: c.c[i]!,
    g: c.g[i]!,
    t: c.t[i]!,
    other: c.other[i]!,
    gcPercent: c.gcPercent[i]!,
    gcSkew: c.gcSkew[i] ?? null,
    atSkew: c.atSkew[i] ?? null,
    source: f.sources[c.source[i]!]!,
  }));
  const bySpecies = new Map<number, RegionStats[]>();
  const byRegion = new Map<Region, RegionStats[]>();
  for (const r of rows) {
    (bySpecies.get(r.speciesId) ?? bySpecies.set(r.speciesId, []).get(r.speciesId)!).push(r);
    (byRegion.get(r.region) ?? byRegion.set(r.region, []).get(r.region)!).push(r);
  }
  return { bySpecies, byRegion };
});

export function getRegionStats(speciesId: number): RegionStats[] {
  return regionStats().bySpecies.get(speciesId) ?? [];
}

export function getRegionStatsForRegion(region: Region): RegionStats[] {
  return regionStats().byRegion.get(region) ?? [];
}

// ---------------------------------------------------------------- codon usage

const codonUsage = memo(() => {
  const f = load<CodonUsageFile>("codon-usage.json");
  const bySpecies = new Map<number, CodonUsage[]>();
  f.rows.speciesId.forEach((speciesId, i) => {
    const counts: Record<string, number> = {};
    const row = f.counts[i]!;
    f.codons.forEach((c, j) => {
      counts[c] = row[j]!;
    });
    const aminoAcids: Record<string, number> = {};
    const aa = f.aminoAcidCounts[i]!;
    f.aminoAcids.forEach((a, j) => {
      aminoAcids[a] = aa[j]!;
    });
    const u: CodonUsage = { speciesId, region: f.regions[f.rows.region[i]!]!, counts, aminoAcids };
    (bySpecies.get(speciesId) ?? bySpecies.set(speciesId, []).get(speciesId)!).push(u);
  });
  return bySpecies;
});

export function getCodonUsage(speciesId: number): CodonUsage[] {
  return codonUsage().get(speciesId) ?? [];
}

// ---------------------------------------------------------------- genome features

const genomeFeatures = memo(() => load<GenomeFeaturesFile>("genome-features.json"));
const featureCache = new Map<number, GenomeFeature[]>();

export function getGenomeFeatures(speciesId: number): GenomeFeature[] {
  const hit = featureCache.get(speciesId);
  if (hit) return hit;
  const f = genomeFeatures();
  const flat = f.bySpecies[String(speciesId)] ?? [];
  const out: GenomeFeature[] = [];
  for (let i = 0; i + f.stride <= flat.length; i += f.stride) {
    out.push({
      name: f.names[flat[i]!]!,
      type: f.types[flat[i + 1]!]!,
      start: flat[i + 2]!,
      end: flat[i + 3]!,
      strand: flat[i + 4] === -1 ? -1 : 1,
    });
  }
  featureCache.set(speciesId, out);
  return out;
}

// ---------------------------------------------------------------- features & correlations

export function getFeatureDefs(): FeatureDef[] {
  return load<FeatureDef[]>("feature-defs.json");
}

const featureValueCache = new Map<string, Record<number, number | null>>();
export function getFeatureValues(featureKey: string): Record<number, number | null> {
  const hit = featureValueCache.get(featureKey);
  if (hit) return hit;
  const f = load<FeatureValuesFile>("feature-values.json");
  const arr = f.values[featureKey];
  const out: Record<number, number | null> = {};
  if (arr) f.speciesIds.forEach((id, i) => (out[id] = arr[i] ?? null));
  featureValueCache.set(featureKey, out);
  return out;
}

const correlations = memo(() => {
  const f = load<CorrelationsFile>("correlations.json");
  const c = f.columns;
  const nan = (v: Nullable | undefined) => (v === null || v === undefined ? Number.NaN : v);
  const rows: Correlation[] = c.feature.map((fi, i) => {
    const row: Correlation = {
      featureKey: f.features[fi]!,
      trait: f.traits[c.trait[i]!]!,
      scope: f.scopes[c.scope[i]!]!,
      n: c.n[i]!,
      pearsonR: nan(c.pearsonR[i]),
      spearmanRho: nan(c.spearmanRho[i]),
      pValue: nan(c.pValue[i]),
      qValue: nan(c.qValue[i]),
      picR: c.picR[i] ?? null,
      picPValue: c.picPValue[i] ?? null,
    };
    const pn = c.partialN[i];
    if (pn !== null && pn !== undefined) {
      row.partialR = c.partialR[i] ?? null;
      row.partialPValue = c.partialPValue[i] ?? null;
      row.partialN = pn;
    }
    return row;
  });
  const byFeature = new Map<string, Correlation[]>();
  const byScopeTrait = new Map<string, Correlation[]>();
  for (const r of rows) {
    (byFeature.get(r.featureKey) ?? byFeature.set(r.featureKey, []).get(r.featureKey)!).push(r);
    const k = `${r.scope}|${r.trait}`;
    (byScopeTrait.get(k) ?? byScopeTrait.set(k, []).get(k)!).push(r);
  }
  return { rows, byFeature, byScopeTrait };
});

export function getCorrelations(filter?: { featureKey?: string; trait?: TraitKey; scope?: string }): Correlation[] {
  const idx = correlations();
  let base: Correlation[];
  if (filter?.featureKey) base = idx.byFeature.get(filter.featureKey) ?? [];
  else if (filter?.scope && filter?.trait) base = idx.byScopeTrait.get(`${filter.scope}|${filter.trait}`) ?? [];
  else base = idx.rows;
  if (!filter) return base;
  return base.filter(
    (r) =>
      (filter.featureKey === undefined || r.featureKey === filter.featureKey) &&
      (filter.trait === undefined || r.trait === filter.trait) &&
      (filter.scope === undefined || r.scope === filter.scope),
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
