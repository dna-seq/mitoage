/**
 * The mtDNA parameters the comparative tables summarise, the regions they cover and the URLs of
 * the Compare section. No data imports: safe for islands.
 *
 * Base percentages are over unambiguous bases (A + C + G + T), like GC % in the pipeline, so
 * GC % + AT % = 100. Skews are on the L strand as deposited in RefSeq: GC skew = (G − C) / (G + C),
 * AT skew = (A − T) / (A + T).
 */
import { AGGREGATE_REGIONS, PROTEIN_GENES, type Rank, type Region } from "~/data/schema";
import { fmtFixed, fmtInt, fmtSigned } from "~/lib/format";
import { regionLabel } from "~/lib/genes";
import { href } from "~/lib/url";
import { geneSlug } from "~/lib/urls";

export type ParamKey = "gc" | "at" | "a" | "t" | "g" | "c" | "gcSkew" | "atSkew" | "length";

export interface Param {
  key: ParamKey;
  /** Button and column label: "GC %", "GC skew", "Length". */
  label: string;
  /** Sentence label: "GC content", "GC skew", "length". */
  noun: string;
  unit: "%" | "bp" | "";
  /** Coefficient of variation is meaningful only for ratio-scale values (not skews around 0). */
  cv: boolean;
  /** Decimals of the mean, SD, min, median and max. */
  digits: number;
  /** Formula shown as a tooltip. */
  title: string;
}

export const PARAMS: readonly Param[] = [
  { key: "gc", label: "GC %", noun: "GC content", unit: "%", cv: true, digits: 2, title: "(G + C) / (A + C + G + T)" },
  { key: "at", label: "AT %", noun: "AT content", unit: "%", cv: true, digits: 2, title: "(A + T) / (A + C + G + T)" },
  { key: "a", label: "A %", noun: "adenine content", unit: "%", cv: true, digits: 2, title: "A / (A + C + G + T)" },
  { key: "t", label: "T %", noun: "thymine content", unit: "%", cv: true, digits: 2, title: "T / (A + C + G + T)" },
  { key: "g", label: "G %", noun: "guanine content", unit: "%", cv: true, digits: 2, title: "G / (A + C + G + T)" },
  { key: "c", label: "C %", noun: "cytosine content", unit: "%", cv: true, digits: 2, title: "C / (A + C + G + T)" },
  { key: "gcSkew", label: "GC skew", noun: "GC skew", unit: "", cv: false, digits: 3, title: "(G − C) / (G + C) on the L strand" },
  { key: "atSkew", label: "AT skew", noun: "AT skew", unit: "", cv: false, digits: 3, title: "(A − T) / (A + T) on the L strand" },
  { key: "length", label: "Length", noun: "length", unit: "bp", cv: true, digits: 0, title: "Length in base pairs" },
];

export const PARAM_KEYS: readonly ParamKey[] = PARAMS.map((p) => p.key);
export const DEFAULT_PARAM: ParamKey = "gc";

export const getParam = (key: string): Param => PARAMS.find((p) => p.key === key) ?? PARAMS[0]!;
export const isParamKey = (key: string): key is ParamKey => PARAMS.some((p) => p.key === key);

/** Value of a parameter, formatted with its unit: "41.82%", "−0.214", "16,569 bp". */
export const fmtParam = (p: Param, v: number | null | undefined, extraDigits = 0): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  const d = p.digits + extraDigits;
  if (p.unit === "%") return `${fmtFixed(v, d)}%`;
  if (p.unit === "bp") return d === 0 ? fmtInt(v) : fmtFixed(v, d);
  return fmtSigned(v, d);
};

/** Standard deviation: no sign, same decimals as the parameter. */
export const fmtSpread = (p: Param, v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  return p.unit === "bp" ? fmtFixed(v, 1) : fmtFixed(v, p.digits);
};

/** Base counts and the derived parameters of one region in one species. */
export interface RegionCounts {
  lengthBp: number;
  a: number;
  c: number;
  g: number;
  t: number;
  gcSkew: number | null;
  atSkew: number | null;
}

export function paramValue(r: RegionCounts, key: ParamKey): number | null {
  const n = r.a + r.c + r.g + r.t;
  const pct = (v: number) => (n > 0 ? (100 * v) / n : null);
  switch (key) {
    case "gc":
      return pct(r.g + r.c);
    case "at":
      return pct(r.a + r.t);
    case "a":
      return pct(r.a);
    case "t":
      return pct(r.t);
    case "g":
      return pct(r.g);
    case "c":
      return pct(r.c);
    case "gcSkew":
      return r.gcSkew;
    case "atSkew":
      return r.atSkew;
    case "length":
      return r.lengthBp > 0 ? r.lengthBp : null;
  }
}

// ---------------------------------------------------------------- regions

/** Table order: whole genome and gene sets first, then the 13 protein-coding genes in genome order. */
export const STATS_REGIONS: readonly Region[] = [...AGGREGATE_REGIONS, ...PROTEIN_GENES];

/** Regions with codon usage. */
export const CODON_REGIONS: readonly Region[] = ["total_pc", ...PROTEIN_GENES];

/** URL slug of a region: "total-mtdna", "nd6", "rrna-12s", "d-loop". */
export const regionSlug = (r: Region): string => geneSlug(r);

export const regionFromSlug = (slug: string): Region | undefined =>
  STATS_REGIONS.find((r) => regionSlug(r) === slug);

/** Region label for tables: "Whole genome", "Protein-coding", "12S rRNA", "ND6". */
export const statsRegionLabel = (r: Region): string => regionLabel(r);

/** Region inside a sentence: "the whole genome", "all protein-coding genes", "the D-loop", "ND6". */
export const regionPhrase = (r: Region): string => {
  switch (r) {
    case "total_mtDNA":
      return "the whole genome";
    case "total_pc":
      return "all protein-coding genes";
    case "total_rRNA":
      return "all rRNA genes";
    case "total_tRNA":
      return "all tRNA genes";
    case "D_Loop":
      return "the D-loop";
    default:
      return regionLabel(r);
  }
};

// ---------------------------------------------------------------- groups

/** Ranks that get comparative tables. */
export type GroupRank = Extract<Rank, "class" | "order" | "family">;
export const GROUP_RANKS: readonly GroupRank[] = ["class", "order", "family"];

/** A group needs this many species for a stats page. */
export const MIN_GROUP_SPECIES = 3;

/** Group key used in data file names: "all", "class-mammalia", "order-primates". */
export const groupKey = (rank: GroupRank | "all", slug?: string): string =>
  rank === "all" ? "all" : `${rank}-${slug}`;

/** Child rank of a group: all species -> class -> order -> family -> genus. */
export const childRank = (rank: GroupRank | "all"): Rank =>
  rank === "all" ? "class" : rank === "class" ? "order" : rank === "order" ? "family" : "genus";

// ---------------------------------------------------------------- URLs

export const compareGroupUrl = (rank: GroupRank | "all" = "all", slug?: string): string =>
  href(rank === "all" ? "/compare/" : `/compare/${rank}/${slug}/`);

export const compareRegionUrl = (r: Region, search = ""): string =>
  href(`/compare/regions/${regionSlug(r)}/${search}`);

export const compareRegionsIndexUrl = (): string => href("/compare/regions/");

export const groupStatsDataUrl = (key: string): string => href(`/compare/stats/${key}.json`);
export const groupCodonsDataUrl = (key: string): string => href(`/compare/codons/${key}.json`);
export const regionValuesDataUrl = (r: Region): string => href(`/compare/values/${regionSlug(r)}.json`);
export const regionValuesCsvUrl = (r: Region): string => href(`/compare/values/${regionSlug(r)}.csv`);
export const TAXONOMY_DATA_URL = href("/compare/taxonomy.json");
