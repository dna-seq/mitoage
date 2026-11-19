/**
 * Wire formats of the static JSON the explorer reads, and their URLs. Safe for islands.
 *
 *   /data/explorer.json                               species, traits, the whole-genome and region features
 *   /compare/plot/values/{gene}-{codon|aa}.json       per-gene codon / amino-acid frequencies
 *   /compare/plot/values/{region}-ext.json            extended features of one region (fourfold sites,
 *                                                     hydropathy, repeats and structure)
 *   /compare/plot/correlations/{trait}/{scope}.json   precomputed correlations for one trait and scope
 */
import type { ExtendedRegion, FeatureDef, Region, TraitKey } from "~/data/schema";
import { href } from "~/lib/url";
import { geneSlug } from "~/lib/urls";

type Num = number | null;

/** public/data/explorer.json (written by the pipeline). */
export interface ExplorerFile {
  build: string;
  generatedAt: string;
  n: number;
  classes: string[];
  orders: string[];
  families: string[];
  species: {
    id: number[];
    slug: string[];
    scientificName: string[];
    commonName: string[];
    class: number[];
    order: number[];
    family: number[];
    /** Index into CONFIDENCE_LEVELS; -1 when the build gives no level. Absent in a file built before the level existed. */
    confidence?: number[];
  };
  traits: Record<TraitKey, Num[]>;
  features: FeatureDef[];
  values: Record<string, Num[]>;
}

export const EXPLORER_URL = href("/data/explorer.json");

/** Codon or amino-acid frequencies of one protein-coding gene, or the extended features of one region, for every species. */
export interface ChunkFile {
  region: Region | ExtendedRegion;
  kind: "codon" | "aa" | "ext";
  /** Species ids, aligned with each values row. */
  ids: number[];
  keys: string[];
  values: Num[][];
}

export const chunkName = (region: Region | string, kind: "codon" | "aa" | "ext"): string => `${geneSlug(region)}-${kind}`;
export const chunkUrl = (region: Region | string, kind: "codon" | "aa" | "ext"): string =>
  href(`/compare/plot/values/${chunkName(region, kind)}.json`);

/**
 * Precomputed correlations for one (trait, scope), rows sorted by |Spearman rho| descending.
 * Columns are parallel arrays; the trait was log10-transformed before correlating.
 */
export interface CorrFile {
  trait: TraitKey;
  scope: string;
  /** Feature keys. */
  f: string[];
  n: number[];
  r: Num[];
  rho: Num[];
  p: Num[];
  q: Num[];
  pic: Num[];
  picP: Num[];
  /** Partial r with log10 lifespan controlling for log10 adult mass (lifespan only). */
  pr?: Num[];
  prP?: Num[];
  prN?: Num[];
}

/** Inline index of the correlation files that exist: rows[traitIndex][scopeIndex] = row count (0 = none). */
export interface CorrIndex {
  traits: TraitKey[];
  scopes: string[];
  rows: number[][];
  /** Number of mtDNA features in the pipeline's catalogue (getFeatureDefs()), for the panel's text. */
  features: number;
}

/** "all" -> "all", "class:Mammalia" -> "class-mammalia". */
export const scopeSlug = (scope: string): string => scope.toLowerCase().replace(":", "-");

export const corrUrl = (trait: TraitKey | string, scope: string): string =>
  href(`/compare/plot/correlations/${trait}/${scopeSlug(scope)}.json`);

/** One precomputed row, unpacked. */
export interface CorrRow {
  feature: string;
  n: number;
  r: number | null;
  rho: number | null;
  p: number | null;
  q: number | null;
  pic: number | null;
  picP: number | null;
  partialR: number | null;
  partialP: number | null;
  partialN: number | null;
}

export const corrRow = (f: CorrFile, i: number): CorrRow => ({
  feature: f.f[i] ?? "",
  n: f.n[i] ?? 0,
  r: f.r[i] ?? null,
  rho: f.rho[i] ?? null,
  p: f.p[i] ?? null,
  q: f.q[i] ?? null,
  pic: f.pic[i] ?? null,
  picP: f.picP[i] ?? null,
  partialR: f.pr?.[i] ?? null,
  partialP: f.prP?.[i] ?? null,
  partialN: f.prN?.[i] ?? null,
});

/** Human label of a scope: "All species", "Mammals (class Mammalia)", "Primates (order)". */
export const scopeParts = (scope: string): { rank: "all" | "class" | "order"; name: string } => {
  if (scope.startsWith("class:")) return { rank: "class", name: scope.slice(6) };
  if (scope.startsWith("order:")) return { rank: "order", name: scope.slice(6) };
  return { rank: "all", name: "" };
};
