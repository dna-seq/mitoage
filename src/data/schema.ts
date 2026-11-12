/**
 * Data contract between the pipeline (pipeline/) and the site (src/).
 *
 * The pipeline writes JSON to src/data/generated/ for build-time page generation
 * and Parquet to public/data/ for the in-browser explorer and for downloads.
 * Pages and components read data only through src/data/index.ts.
 */

export type Rank = "kingdom" | "phylum" | "class" | "order" | "family" | "genus" | "species";

/** Regions of the mitochondrial genome that carry statistics. */
export const PROTEIN_GENES = [
  "ND1", "ND2", "COX1", "COX2", "ATP8", "ATP6", "COX3",
  "ND3", "ND4L", "ND4", "ND5", "ND6", "CYTB",
] as const;
export type ProteinGene = (typeof PROTEIN_GENES)[number];

export const AGGREGATE_REGIONS = [
  "total_mtDNA", "total_pc", "total_rRNA", "total_tRNA", "rRNA-12S", "rRNA-16S", "D_Loop",
] as const;
export type AggregateRegion = (typeof AGGREGATE_REGIONS)[number];

export type Region = ProteinGene | AggregateRegion;

export interface Taxonomy {
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
}

/** Life-history traits. Every field is null when the source has no value. */
export interface Traits {
  adultWeightG: number | null;
  birthWeightG: number | null;
  metabolicRateW: number | null;
  bodyTemperatureK: number | null;
  femaleMaturityDays: number | null;
  maleMaturityDays: number | null;
  gestationDays: number | null;
  litterSize: number | null;
  littersPerYear: number | null;
  growthRatePerDay: number | null;
  /** Where each non-null trait came from, e.g. "AnAge build 15". */
  source: string | null;
}
export type TraitKey = Exclude<keyof Traits, "source"> | "maxLongevityYears";

export interface Species {
  /** AnAge identifier (HAGRID). */
  id: number;
  /** URL slug, e.g. "homo-sapiens". Unique. */
  slug: string;
  refseq: string;
  scientificName: string;
  commonName: string;
  taxonomy: Taxonomy;
  maxLongevityYears: number;
  mtdnaSizeBp: number;
  nonCodingBp: number | null;
  /** Whole-genome GC percent, 0-100. */
  gcPercent: number;
  traits: Traits;
  /** Numeric id used by the old site at /view/{legacyId}/species/, when known. */
  legacyId: number | null;
}

/** Base composition of one region in one species. */
export interface RegionStats {
  speciesId: number;
  region: Region;
  lengthBp: number;
  a: number;
  c: number;
  g: number;
  t: number;
  other: number;
  gcPercent: number;
  /** (G - C) / (G + C) on the reference (L) strand as deposited in RefSeq. */
  gcSkew: number | null;
  atSkew: number | null;
  /**
   * Optional provenance (added by the pipeline): "mitoage" = MitoAge build 1 CSV (label-fixed),
   * "genbank" = recomputed from the RefSeq record because the CSV had no value.
   */
  source?: "mitoage" | "genbank";
}

/** Codon counts for a protein-coding gene, or for all of them ("total_pc"). */
export interface CodonUsage {
  speciesId: number;
  region: ProteinGene | "total_pc";
  /** Codon (RNA alphabet, e.g. "CUA") to count. All 64 codons present. */
  counts: Record<string, number>;
  /** One-letter amino acid to count, derived with the mitochondrial code of the species. */
  aminoAcids: Record<string, number>;
}

export type FeatureType = "CDS" | "rRNA" | "tRNA" | "D-loop";

/** One annotated feature on the circular genome, from the RefSeq record. */
export interface GenomeFeature {
  /** Normalised name: a ProteinGene, "rRNA-12S", "rRNA-16S", "D_Loop", or a tRNA such as "tRNA-Phe". */
  name: string;
  type: FeatureType;
  /** 1-based inclusive coordinates. start > end means the feature wraps the origin. */
  start: number;
  end: number;
  strand: 1 | -1;
}

export interface TaxonNode {
  name: string;
  rank: Rank;
  /** URL slug, unique within its rank, e.g. "mammalia". */
  slug: string;
  /** Number of species below this node. */
  speciesCount: number;
  children: TaxonNode[];
  /** Set on species leaves only. */
  speciesId?: number;
  /** Divergence time from the parent in million years, when a dated tree is available. */
  branchLengthMya?: number | null;
}

/** A numeric mtDNA feature that can be plotted or correlated, e.g. GC% of ND6. */
export interface FeatureDef {
  /** Stable key, e.g. "gc:total_mtDNA", "gcSkew:ND6", "codon:total_pc:CUA", "size:total_mtDNA". */
  key: string;
  label: string;
  region: Region;
  group: "composition" | "skew" | "size" | "codon" | "aminoAcid";
}

export interface Correlation {
  featureKey: string;
  trait: TraitKey;
  /** "all" or "class:Mammalia", "order:Primates". */
  scope: string;
  n: number;
  /** Trait is log10-transformed before correlating. */
  pearsonR: number;
  spearmanRho: number;
  pValue: number;
  /** Benjamini-Hochberg q-value within (trait, scope). */
  qValue: number;
  /** Phylogenetically independent contrasts correlation, when a dated tree is available. */
  picR: number | null;
  picPValue: number | null;
  /**
   * Optional (added by the pipeline), only for trait "maxLongevityYears": partial correlation of the
   * feature with log10 lifespan controlling for log10 adult weight, its p-value and sample size.
   */
  partialR?: number | null;
  partialPValue?: number | null;
  partialN?: number;
}

export interface BuildInfo {
  build: string;
  generatedAt: string;
  speciesCount: number;
  sources: { name: string; version: string; url: string; license: string }[];
  /** Data problems found and how they were handled, shown on the methods page. */
  notes: string[];
}

/**
 * API that src/data/index.ts exports. All functions are synchronous and read
 * the generated JSON, so they are usable in Astro frontmatter and getStaticPaths.
 */
export interface DataApi {
  getBuildInfo(): BuildInfo;
  getAllSpecies(): Species[];
  getSpeciesBySlug(slug: string): Species | undefined;
  getSpeciesById(id: number): Species | undefined;
  getTaxonomyTree(): TaxonNode;
  /** Flat list of every node above species rank. */
  getTaxa(): TaxonNode[];
  getTaxon(rank: Rank, slug: string): TaxonNode | undefined;
  getSpeciesInTaxon(rank: Rank, slug: string): Species[];
  getRegionStats(speciesId: number): RegionStats[];
  getRegionStatsForRegion(region: Region): RegionStats[];
  getCodonUsage(speciesId: number): CodonUsage[];
  getGenomeFeatures(speciesId: number): GenomeFeature[];
  getFeatureDefs(): FeatureDef[];
  /** Value of one feature for every species, keyed by species id. */
  getFeatureValues(featureKey: string): Record<number, number | null>;
  getCorrelations(filter?: { featureKey?: string; trait?: TraitKey; scope?: string }): Correlation[];
}
