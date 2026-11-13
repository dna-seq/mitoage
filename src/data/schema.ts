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

/** Row status against build 1 (plans/DATA_BUILD2_DECISIONS.md, section 5-6). */
export const RECORD_STATUSES = ["original", "updated", "new", "renamed", "retired"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/**
 * Row-level edit metadata carried by every data table (species, region_stats, codon_usage,
 * genome_features, lifespan_observations). Timestamps are ISO-8601 UTC.
 */
export interface RowProvenance {
  /** 1 or 2. */
  addedInBuild: number;
  /** When the row first entered the database (build 1 rows: the 2015-07-01 build date). */
  addedAt: string;
  /** Build of the latest change; null when the row never changed. */
  lastModifiedBuild: number | null;
  lastModifiedAt: string | null;
  recordStatus: RecordStatus;
  /** Upstream version used for this row, e.g. "NC_012920.1" or "AnAge build 15". */
  sourceVersion: string;
}

/** Shared quality scale for lifespan values (AnAge data quality; other sources mapped onto it). */
export const LIFESPAN_QUALITIES = ["high", "acceptable", "questionable", "low"] as const;
export type LifespanQuality = (typeof LIFESPAN_QUALITIES)[number];
/** captive / wild: specimen origin; observed: origin not stated; estimated: derived from a growth study; compiled: MitoAge build 1 value. */
export type LifespanRecordType = "captive" | "wild" | "observed" | "estimated" | "compiled";
export type LifespanSource = "AnAge" | "FishBase" | "SeaLifeBase" | "EURING" | "USGS_BBL" | "MitoAge_build1";

/** Where the maximum lifespan of a species comes from (the chosen value; every value is in lifespan_observations). */
export interface LifespanInfo {
  source: LifespanSource;
  sourceVersion: string;
  /** Record id in the source: AnAge HAGRID, FishBase "popchar:123", USGS row id. */
  sourceRecordId: string;
  quality: LifespanQuality | null;
  /** AnAge sample size (tiny .. huge); null for other sources. */
  sampleSize: string | null;
  recordType: LifespanRecordType;
  license: string;
}

export interface Species {
  /**
   * MitoAge species id. Build 1 species keep their build 1 id (the AnAge HAGRID of 2015);
   * species added later get 10,000,000 + NCBI taxid.
   */
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
  /** NCBI taxon id of the RefSeq record's organism (may be a subspecies), current after merges. */
  ncbiTaxid?: number | null;
  /** NCBI species-rank taxon id: the cross-source join key. */
  ncbiSpeciesTaxid?: number | null;
  /** Build 2 additions (optional so build 1 consumers keep working). */
  provenance?: RowProvenance;
  lifespan?: LifespanInfo;
  /** Names this row had in earlier builds, oldest first. */
  previousScientificNames?: string[];
  /** Set when recordStatus is "retired": why the row no longer qualifies. */
  retiredReason?: string | null;
  /** Open questions about this row for the curators (e.g. "possible_duplicate_species"). */
  reviewFlags?: string[];
  /** Kinds of change against build 1 (genome, annotation, lifespan, name, taxonomy, common_name, ncbi_taxid). */
  changeKinds?: string[];
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
  provenance?: RowProvenance;
}

/** Codon counts for a protein-coding gene, or for all of them ("total_pc"). */
export interface CodonUsage {
  speciesId: number;
  region: ProteinGene | "total_pc";
  /** Codon (RNA alphabet, e.g. "CUA") to count. All 64 codons present. */
  counts: Record<string, number>;
  /** One-letter amino acid to count, derived with the mitochondrial code of the species. */
  aminoAcids: Record<string, number>;
  provenance?: RowProvenance;
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
  provenance?: RowProvenance;
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
  /** Species set (see CORRELATION_DATASETS); absent means "default". */
  dataset?: CorrelationDataset;
}

/**
 * Species sets correlations are computed on. "default": every non-retired species whose lifespan is
 * neither estimated nor of low or questionable quality, from any lifespan source. "anage_only": the
 * same filters, lifespan from AnAge only (comparable with the 2016 paper).
 */
export const CORRELATION_DATASETS = ["default", "anage_only"] as const;
export type CorrelationDataset = (typeof CORRELATION_DATASETS)[number];

/** One lifespan value from one source (long format; every source value is kept, not only the chosen one). */
export interface LifespanObservation {
  /** MitoAge species id. */
  speciesId: number;
  ncbiTaxid: number;
  source: LifespanSource;
  sourceVersion: string;
  sourceRecordId: string;
  sourceName: string;
  valueYears: number;
  recordType: LifespanRecordType;
  quality: LifespanQuality | null;
  sampleSizeText: string | null;
  sex: string | null;
  detail: string | null;
  reference: string | null;
  license: string;
  matchMethod: string;
  /** This value is the species' maxLongevityYears. */
  isChosen: boolean;
  provenance: RowProvenance;
}

export type ChangeType = "added" | "value_update" | "renamed" | "retired" | "correction";

/** One field change between builds (public/data/changelog.parquet). */
export interface ChangelogEntry {
  build: number;
  changedAt: string;
  /** species, region_stats, codon_usage, genome_features or lifespan_observations. */
  table: string;
  /** Row key in that table, e.g. "3221" or "3221:ND6"; "*" for a rule. */
  rowKey: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: ChangeType;
  /** Finer class, e.g. rule_full_span, upstream_version_change. */
  diffClass: string;
  reason: string;
  upstreamSource: string;
  upstreamVersion: string;
  /** "rule" marks a systematic correction logged once (or per instance with this flag), "row" a single change. */
  scope: "row" | "rule";
}

export interface BuildInfo {
  build: string;
  /** Build number (1, 2, ...); absent in build 1 files. */
  buildNumber?: number;
  /** Date of the build release, ISO-8601 UTC. */
  buildDate?: string;
  /** Species per record status. */
  recordStatusCounts?: Partial<Record<RecordStatus, number>>;
  /** What each correlation dataset contains, recorded with the build. */
  correlationDatasets?: { dataset: CorrelationDataset; filters: string; lifespanSources: string[]; species: number }[];
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
  /** Rows of the "default" dataset unless filter.dataset is given. */
  getCorrelations(filter?: { featureKey?: string; trait?: TraitKey; scope?: string; dataset?: CorrelationDataset }): Correlation[];
}
