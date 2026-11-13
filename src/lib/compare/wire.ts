/**
 * Wire formats of the static JSON behind the comparative tables. Safe for islands.
 *
 *   /compare/taxonomy.json          every species with its class, order, family, genus and lifespan
 *   /compare/stats/{group}.json     summary of every region and parameter in one group
 *   /compare/codons/{group}.json    codon and amino-acid frequency summaries in one group
 *   /compare/values/{region}.json   every species' base counts, skews and length for one region
 *   /compare/values/{region}.csv    the same as a CSV download
 */
import type { Rank, Region } from "~/data/schema";
import type { ParamKey } from "./params";

/** One summary: [n, mean, sd, min, minSpecies, median, max, maxSpecies, r, p]. Species are indices into `species` (-1 = none). r and p: Pearson with log10 lifespan (null below 5 species). */
export type StatTuple = [
  n: number,
  mean: number | null,
  sd: number | null,
  min: number | null,
  minSpecies: number,
  median: number | null,
  max: number | null,
  maxSpecies: number,
  r: number | null,
  p: number | null,
];

export interface GroupStatsFile {
  key: string;
  name: string;
  rank: Rank | "all";
  speciesCount: number;
  /** Species named as a minimum or maximum: [slug, scientific name, common name]. */
  species: [slug: string, name: string, common: string][];
  stats: Partial<Record<Region, Partial<Record<ParamKey, StatTuple>>>>;
}

/** One frequency summary: [n, mean, sd, min, median, max], in % of codons (or of sense codons). */
export type FreqTuple = [n: number, mean: number | null, sd: number | null, min: number | null, median: number | null, max: number | null];

export interface GroupCodonsFile {
  key: string;
  regions: Region[];
  codons: string[];
  aminoAcids: string[];
  /** codon[regionIndex][codonIndex] */
  codon: FreqTuple[][];
  /** aa[regionIndex][aminoAcidIndex] */
  aa: FreqTuple[][];
}

export interface TaxonList {
  names: string[];
  slugs: string[];
}

export interface TaxonomyFile {
  class: TaxonList;
  order: TaxonList;
  family: TaxonList;
  genus: TaxonList;
  /** [slug, scientific name, common name, class, order, family, genus (indices), max lifespan in years] */
  species: [slug: string, name: string, common: string, cls: number, order: number, family: number, genus: number, lifespan: number][];
  /** "rank:slug" of every class, order and family that has its own stats page. */
  groups: string[];
}

export interface RegionValuesFile {
  region: Region;
  /** Index of each row's species in TaxonomyFile.species. */
  species: number[];
  length: number[];
  a: number[];
  c: number[];
  g: number[];
  t: number[];
  gcSkew: (number | null)[];
  atSkew: (number | null)[];
}
