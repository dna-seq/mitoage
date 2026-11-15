/**
 * Everything the plot explorer can put on an axis: 11 life-history traits and every mtDNA feature
 * of the pipeline (size, GC%, GC/AT balance per region; codon and amino-acid frequencies per protein-coding
 * region; and the extended features: fourfold-site composition, protein hydropathy, repeats, non-B
 * motifs, the major arc, the control-region count and the deletion contact zones). Labels, units,
 * default log scale and formatters live here.
 * No data imports: safe for islands. The page checks at build time that FEATURE_KEYS matches the
 * pipeline's feature list exactly, so the feature count is never written here.
 */
import { AGGREGATE_REGIONS, type ExtendedRegion, PROTEIN_GENES, type Region, type TraitKey } from "~/data/schema";
import { fmtBp, fmtDays, fmtKelvinAsCelsius, fmtLifespan, fmtMass, fmtNum, fmtPct, fmtSigned } from "~/lib/format";
import { REGION_INFO } from "~/lib/genes";
import { AMINO_ACIDS, CODONS, VERTEBRATE_MITO } from "~/lib/geneticCode";
import { fmtCompact, fmtSignedTick } from "./format";

export type Measure =
  | "size"
  | "noncoding"
  | "gc"
  | "gcSkew"
  | "atSkew"
  | "codon"
  | "aa"
  | "ff"
  | "ffH"
  | "gravy"
  | "repeats"
  | "motifs"
  | "contactZone"
  | "controlRegions";
export type VarGroup = "trait" | "composition" | "codon" | "aminoAcid" | "fourfold" | "hydropathy" | "structure";
/** The groups of the extended mtDNA features, served in per-region chunks rather than in explorer.json. */
export const EXTENDED_GROUPS: readonly VarGroup[] = ["fourfold", "hydropathy", "structure"];
/** A region of the region statistics, or one that exists only for extended features (major arc, major12). */
export type VarRegion = Region | ExtendedRegion;

interface VarBase {
  /** URL and data key: a TraitKey or a feature key such as "gc:ND6". */
  key: string;
  /** Sentence label: "GC content of ND6". */
  label: string;
  /** Axis label: "ND6 GC". */
  short: string;
  /** Unit for axis titles: "%", "bp", "years". */
  unit: string;
  defaultLog: boolean;
  group: VarGroup;
  tick: (v: number) => string;
  value: (v: number) => string;
  /** Lower-case text matched by the picker search. */
  search: string;
}

export interface TraitVar extends VarBase {
  kind: "trait";
  trait: TraitKey;
}

export interface FeatureVar extends VarBase {
  kind: "feature";
  measure: Measure;
  region: VarRegion;
  /** Codon ("CUA"), amino-acid letter ("L"), base ("A") or sub-measure ("direct", "g4"); null otherwise. */
  sub: string | null;
}

export type Variable = TraitVar | FeatureVar;

// ---------------------------------------------------------------- regions

/** Regions in picker order: whole genome and gene sets first, then genes in genome order. */
export const REGION_ORDER: readonly Region[] = [...AGGREGATE_REGIONS, ...PROTEIN_GENES];

/** Regions that have codon and amino-acid features (and gene-sense fourfold and GRAVY features). */
export const CODING_REGIONS: readonly Region[] = ["total_pc", ...PROTEIN_GENES];

/** Regions with heavy-strand fourfold features: the 12 genes other than ND6 together, then each gene. */
export const HEAVY_REGIONS: readonly VarRegion[] = ["major12", ...PROTEIN_GENES];

/** Regions with fourfold features of either notation, in picker order. */
export const FOURFOLD_REGIONS: readonly VarRegion[] = ["total_pc", "major12", ...PROTEIN_GENES];

/** Regions of the repeat and motif features. */
export const STRUCTURE_REGIONS: readonly VarRegion[] = ["total_mtDNA", "major_arc"];

/** Short region name for axis titles. */
export const regionShort = (r: VarRegion): string => {
  switch (r) {
    case "major_arc":
      return "Major arc";
    case "major12":
      return "All but ND6";
    case "total_mtDNA":
      return "mtDNA";
    case "total_pc":
      return "Protein-coding";
    case "total_rRNA":
      return "rRNA";
    case "total_tRNA":
      return "tRNA";
    case "rRNA-12S":
      return "12S rRNA";
    case "rRNA-16S":
      return "16S rRNA";
    case "D_Loop":
      return "D-loop";
    default:
      return r;
  }
};

/** Region name inside a sentence: "the whole mtDNA", "all protein-coding genes", "ND6". */
export const regionPhrase = (r: VarRegion): string => {
  switch (r) {
    case "major_arc":
      return "the major arc";
    case "major12":
      return "the 12 protein-coding genes other than ND6";
    case "total_mtDNA":
      return "the whole mtDNA";
    case "total_pc":
      return "all protein-coding genes";
    case "total_rRNA":
      return "both rRNA genes";
    case "total_tRNA":
      return "all tRNA genes";
    case "D_Loop":
      return "the D-loop";
    default:
      return regionShort(r);
  }
};

/** Picker label for a region: "Whole genome", "All protein-coding", "ND6". */
export const regionPickerLabel = (r: VarRegion): string => {
  switch (r) {
    case "total_mtDNA":
      return "Whole genome";
    case "total_pc":
      return "All protein-coding";
    case "total_rRNA":
      return "All rRNA";
    case "total_tRNA":
      return "All tRNA";
    default:
      return regionShort(r);
  }
};

// ---------------------------------------------------------------- traits

const lifespanTick = (v: number): string => (v < 1 ? `${fmtNum(v, 2)} yr` : `${fmtNum(v, 0)} yr`);
const massTick = (v: number): string => fmtMass(v).replace(/\.0(?= )/, "");
const daysTick = (v: number): string => `${fmtCompact(v)} d`;

interface TraitSpec {
  key: TraitKey;
  label: string;
  short: string;
  unit: string;
  log: boolean;
  tick: (v: number) => string;
  value: (v: number) => string;
  words: string;
}

const TRAIT_SPECS: readonly TraitSpec[] = [
  {
    key: "maxLongevityYears",
    label: "Maximum lifespan",
    short: "Max lifespan",
    unit: "years",
    log: true,
    tick: lifespanTick,
    value: fmtLifespan,
    words: "longevity age life span aging ageing",
  },
  {
    key: "adultWeightG",
    label: "Adult body mass",
    short: "Adult mass",
    unit: "",
    log: true,
    tick: massTick,
    value: fmtMass,
    words: "weight size body",
  },
  {
    key: "birthWeightG",
    label: "Birth mass",
    short: "Birth mass",
    unit: "",
    log: true,
    tick: massTick,
    value: fmtMass,
    words: "weight newborn neonate",
  },
  {
    key: "metabolicRateW",
    label: "Basal metabolic rate",
    short: "Metabolic rate",
    unit: "W",
    log: true,
    tick: fmtCompact,
    value: (v) => `${fmtNum(v, 3)} W`,
    words: "bmr energy watts",
  },
  {
    key: "bodyTemperatureK",
    label: "Body temperature",
    short: "Body temperature",
    unit: "",
    log: false,
    tick: (v) => `${fmtNum(v - 273.15, 0)} °C`,
    value: fmtKelvinAsCelsius,
    words: "heat celsius kelvin",
  },
  {
    key: "femaleMaturityDays",
    label: "Female sexual maturity",
    short: "Female maturity",
    unit: "",
    log: true,
    tick: daysTick,
    value: fmtDays,
    words: "age puberty reproduction",
  },
  {
    key: "maleMaturityDays",
    label: "Male sexual maturity",
    short: "Male maturity",
    unit: "",
    log: true,
    tick: daysTick,
    value: fmtDays,
    words: "age puberty reproduction",
  },
  {
    key: "gestationDays",
    label: "Gestation or incubation",
    short: "Gestation",
    unit: "",
    log: true,
    tick: daysTick,
    value: fmtDays,
    words: "pregnancy incubation",
  },
  {
    key: "litterSize",
    label: "Litter or clutch size",
    short: "Litter size",
    unit: "",
    log: true,
    tick: fmtCompact,
    value: (v) => fmtNum(v, 1),
    words: "offspring clutch eggs fecundity",
  },
  {
    key: "littersPerYear",
    label: "Litters per year",
    short: "Litters per year",
    unit: "",
    log: false,
    tick: (v) => fmtNum(v, 1),
    value: (v) => fmtNum(v, 1),
    words: "reproduction frequency clutches",
  },
  {
    key: "growthRatePerDay",
    label: "Postnatal growth rate",
    short: "Growth rate",
    unit: "per day",
    log: true,
    tick: fmtCompact,
    value: (v) => `${fmtNum(v, 4)} per day`,
    words: "development",
  },
];

export const TRAIT_KEYS: readonly TraitKey[] = TRAIT_SPECS.map((t) => t.key);

const traitVar = (t: TraitSpec): TraitVar => ({
  kind: "trait",
  trait: t.key,
  key: t.key,
  label: t.label,
  short: t.short,
  unit: t.unit,
  defaultLog: t.log,
  group: "trait",
  tick: t.tick,
  value: t.value,
  search: `${t.label} ${t.short} ${t.words} life history trait`.toLowerCase(),
});

// ---------------------------------------------------------------- features

/** The 20 amino acids, in the pipeline's (alphabetical one-letter) order. */
export const AMINO_ACID_LETTERS = "ACDEFGHIKLMNPQRSTVWY".split("");

/** Amino acid of a codon under the vertebrate mitochondrial code, as three letters ("Stop" for stops). */
export const codonAminoAcid = (codon: string): string => {
  const aa = VERTEBRATE_MITO.table[codon] ?? "X";
  return AMINO_ACIDS[aa]?.three ?? aa;
};

const pctValue = (v: number): string => fmtPct(v, 2);
const pctTick = (v: number): string => fmtNum(v, 1);

const regionWords = (r: VarRegion): string => {
  if (r === "major_arc") return "major arc major_arc between the replication origins ol oh";
  if (r === "major12") return "major12 all but nd6 12 genes protein coding heavy strand";
  const info = REGION_INFO[r];
  return `${r} ${regionShort(r)} ${regionPickerLabel(r)} ${info.name} ${info.kind}`.replace(/[_-]/g, " ");
};

const feature = (
  measure: Measure,
  region: Region,
  sub: string | null,
): FeatureVar => {
  const rs = regionShort(region);
  const rp = regionPhrase(region);
  const base = { kind: "feature" as const, measure, region, sub, defaultLog: false };
  switch (measure) {
    case "size":
      return {
        ...base,
        key: `size:${region}`,
        label: `Length of ${rp}`,
        short: `${rs} length`,
        unit: "bp",
        group: "composition",
        tick: fmtCompact,
        value: fmtBp,
        search: `length size bp ${regionWords(region)}`.toLowerCase(),
      };
    case "noncoding":
      return {
        ...base,
        key: `noncoding:${region}`,
        label: "Non-coding length of the mtDNA",
        short: "Non-coding length",
        unit: "bp",
        group: "composition",
        tick: fmtCompact,
        value: fmtBp,
        search: `non-coding noncoding length size bp intergenic ${regionWords(region)}`.toLowerCase(),
      };
    case "gc":
      return {
        ...base,
        key: `gc:${region}`,
        label: `GC content of ${rp}`,
        short: `${rs} GC`,
        unit: "%",
        group: "composition",
        tick: pctTick,
        value: pctValue,
        search: `gc gc% content composition guanine cytosine ${regionWords(region)}`.toLowerCase(),
      };
    case "gcSkew":
    case "atSkew": {
      const gc = measure === "gcSkew";
      return {
        ...base,
        key: `${measure}:${region}`,
        label: `${gc ? "GC" : "AT"} balance of ${rp}`,
        short: `${rs} ${gc ? "GC" : "AT"} balance`,
        unit: "",
        group: "composition",
        tick: (v) => fmtSignedTick(v, 2),
        value: (v) => fmtSigned(v, 3),
        search: `${gc ? "gc balance gc skew gcskew g-c" : "at balance at skew atskew a-t"} strand asymmetry ${regionWords(region)}`.toLowerCase(),
      };
    }
    case "codon": {
      const codon = sub ?? "";
      const aa = codonAminoAcid(codon);
      return {
        ...base,
        key: `codon:${region}:${codon}`,
        label: `${codon} codon (${aa}) in ${rp}`,
        short: `${rs} ${codon} (${aa})`,
        unit: "% of codons",
        group: "codon",
        tick: pctTick,
        value: pctValue,
        search: `${codon} ${codon.replace(/U/g, "T")} codon usage ${aa} ${regionWords(region)}`.toLowerCase(),
      };
    }
    case "aa": {
      const letter = sub ?? "";
      const info = AMINO_ACIDS[letter];
      const three = info?.three ?? letter;
      return {
        ...base,
        key: `aa:${region}:${letter}`,
        label: `${info?.name ?? letter} (${three}) in ${rp}`,
        short: `${rs} ${three}`,
        unit: "% of sense codons",
        group: "aminoAcid",
        tick: pctTick,
        value: pctValue,
        search: `${three} ${info?.name ?? ""} amino acid aa protein ${regionWords(region)}`.toLowerCase(),
      };
    }
    default:
      throw new Error(`feature(): ${measure} is an extended measure, built by buildExtendedFeatures`);
  }
};

/** Every feature key, in the order the pipeline lists them (checked at build time). */
const buildFeatures = (): FeatureVar[] => {
  const out: FeatureVar[] = [];
  for (const r of REGION_ORDER) {
    out.push(feature("size", r, null), feature("gc", r, null), feature("gcSkew", r, null), feature("atSkew", r, null));
    if (r === "total_mtDNA") out.push(feature("noncoding", r, null));
  }
  for (const r of CODING_REGIONS) {
    for (const c of CODONS) out.push(feature("codon", r, c));
    for (const a of AMINO_ACID_LETTERS) out.push(feature("aa", r, a));
  }
  return out;
};

// ---------------------------------------------------------------- extended features

/**
 * Thresholds of the repeat and motif features, written into their labels. They mirror the
 * pipeline's constants (pipeline/steps/extended.ts, pipeline/lib/motifs.ts), which this module
 * cannot import; a unit test compares the two.
 */
export const EXTENDED_THRESHOLDS = { repeatMinBp: 10, tractMinBp: 15, homopolymerMinBp: 5, strMinUnits: 3 } as const;
const T = EXTENDED_THRESHOLDS;

const countTick = (v: number): string => fmtCompact(v);
const countValue = (v: number): string => fmtNum(v, 0);

interface StructureSpec {
  measure: "repeats" | "motifs";
  sub: string;
  label: string;
  short: string;
  unit: string;
  words: string;
}

/** Repeat and motif features of the whole mtDNA and the major arc, in the pipeline's order. */
const REPEAT_SPECS: readonly StructureSpec[] = [
  { measure: "repeats", sub: "direct", label: `Perfect direct repeats ≥ ${T.repeatMinBp} bp`, short: "direct repeats", unit: "pairs", words: "direct repeat pairs" },
  { measure: "repeats", sub: "inverted", label: `Perfect inverted repeats ≥ ${T.repeatMinBp} bp`, short: "inverted repeats", unit: "pairs", words: "inverted repeat pairs palindrome reverse complement" },
  { measure: "repeats", sub: "longestDirect", label: "Longest perfect direct repeat", short: "longest direct repeat", unit: "bp", words: "longest direct repeat length" },
];
const MOTIF_SPECS: readonly StructureSpec[] = [
  { measure: "repeats", sub: "mirror", label: `Perfect mirror repeats ≥ ${T.repeatMinBp} bp`, short: "mirror repeats", unit: "pairs", words: "mirror repeat pairs triplex h-dna" },
  { measure: "motifs", sub: "g4", label: "G-quadruplex motifs, both strands", short: "G4 motifs", unit: "count", words: "g4 g-quadruplex quadruplex guanine non-b dna" },
  { measure: "motifs", sub: "purineTracts", label: `Homopurine tracts ≥ ${T.tractMinBp} bp`, short: "purine tracts", unit: "count", words: "homopurine purine tract non-b dna triplex" },
  { measure: "motifs", sub: "pyrimidineTracts", label: `Homopyrimidine tracts ≥ ${T.tractMinBp} bp`, short: "pyrimidine tracts", unit: "count", words: "homopyrimidine pyrimidine tract non-b dna triplex" },
  { measure: "motifs", sub: "homopolymerRuns", label: `Homopolymer runs ≥ ${T.homopolymerMinBp} bp`, short: "homopolymer runs", unit: "count", words: "homopolymer run poly simple repeat" },
  { measure: "motifs", sub: "longestHomopolymer", label: "Longest homopolymer run", short: "longest homopolymer", unit: "bp", words: "longest homopolymer run length" },
  { measure: "motifs", sub: "strDi", label: `Dinucleotide tandem repeats ≥ ${T.strMinUnits} units`, short: "dinucleotide repeats", unit: "count", words: "dinucleotide tandem repeat str microsatellite simple" },
  { measure: "motifs", sub: "strTri", label: `Trinucleotide tandem repeats ≥ ${T.strMinUnits} units`, short: "trinucleotide repeats", unit: "count", words: "trinucleotide tandem repeat str microsatellite simple" },
  { measure: "motifs", sub: "strTetra", label: `Tetranucleotide tandem repeats ≥ ${T.strMinUnits} units`, short: "tetranucleotide repeats", unit: "count", words: "tetranucleotide tandem repeat str microsatellite simple" },
  { measure: "motifs", sub: "strBases", label: "Bases in counted tandem repeats", short: "tandem-repeat bases", unit: "bp", words: "tandem repeat bases str microsatellite length" },
];
/** Every repeat and motif measure, in picker order (rows of the Repeats tab). */
export const STRUCTURE_SPECS: readonly StructureSpec[] = [...REPEAT_SPECS, ...MOTIF_SPECS];

const fourfold = (heavy: boolean, region: VarRegion, base: string): FeatureVar => {
  const rs = regionShort(region);
  const rp = regionPhrase(region);
  return {
    kind: "feature",
    measure: heavy ? "ffH" : "ff",
    region,
    sub: base,
    defaultLog: false,
    key: `${heavy ? "ffH" : "ff"}:${region}:${base}`,
    label: heavy
      ? `${base} on the heavy strand at fourfold-degenerate sites of ${rp}`
      : `${base} at fourfold-degenerate sites of ${rp} (gene sense)`,
    short: `${rs} 4-fold ${base}${heavy ? " (H)" : ""}`,
    unit: "% of fourfold sites",
    group: "fourfold",
    tick: pctTick,
    value: pctValue,
    search: `fourfold four-fold 4-fold degenerate synonymous silent third position base composition ${base} ${
      heavy ? "heavy strand h-strand h" : "gene sense"
    } ${regionWords(region)}`.toLowerCase(),
  };
};

const gravyVar = (region: VarRegion): FeatureVar => ({
  kind: "feature",
  measure: "gravy",
  region,
  sub: null,
  defaultLog: false,
  key: `gravy:${region}`,
  label: `Protein hydropathy (GRAVY) of ${regionPhrase(region)}`,
  short: `${regionShort(region)} GRAVY`,
  unit: "",
  group: "hydropathy",
  tick: (v) => fmtNum(v, 2),
  value: (v) => fmtSigned(v, 3),
  search: `gravy hydropathy hydrophobicity kyte doolittle protein amino acid ${regionWords(region)}`.toLowerCase(),
});

const structureVar = (s: StructureSpec, region: VarRegion): FeatureVar => ({
  kind: "feature",
  measure: s.measure,
  region,
  sub: s.sub,
  defaultLog: false,
  key: `${s.measure}:${s.sub}:${region}`,
  label: `${s.label} in ${regionPhrase(region)}`,
  short: `${regionShort(region)} ${s.short}`,
  unit: s.unit,
  group: "structure",
  tick: countTick,
  value: s.unit === "bp" ? fmtBp : countValue,
  search: `${s.words} repeats motifs structure ${regionWords(region)}`.toLowerCase(),
});

/** The three kinds of repeat pair counted across the deletion contact zones. */
export const CONTACT_KINDS = ["direct", "inverted", "mirror"] as const;

const contactVar = (k: (typeof CONTACT_KINDS)[number]): FeatureVar => ({
  kind: "feature",
  measure: "contactZone",
  region: "total_mtDNA",
  sub: k,
  defaultLog: false,
  key: `contactZone:${k}:total_mtDNA`,
  label: `Perfect ${k} repeat pairs bridging the ATP8–COX3 and ND5–CYTB spans`,
  short: `Contact-zone ${k} pairs`,
  unit: "pairs",
  group: "structure",
  tick: countTick,
  value: countValue,
  search: `contact zone deletion breakpoint bridging ${k} repeat pairs atp8 cox3 nd5 cytb whole mtdna`,
});

const majorArcLength: FeatureVar = {
  kind: "feature",
  measure: "size",
  region: "major_arc",
  sub: null,
  defaultLog: false,
  key: "size:major_arc",
  label: "Length of the major arc",
  short: "Major arc length",
  unit: "bp",
  group: "structure",
  tick: fmtCompact,
  value: fmtBp,
  search: `length size bp ${regionWords("major_arc")}`,
};

const controlRegions: FeatureVar = {
  kind: "feature",
  measure: "controlRegions",
  region: "total_mtDNA",
  sub: null,
  defaultLog: false,
  key: "controlRegions:total_mtDNA",
  label: "Annotated control regions",
  short: "Control regions",
  unit: "count",
  group: "structure",
  tick: countTick,
  value: countValue,
  search: "control regions d-loop dloop duplicated count whole mtdna",
};

/** The extended features, in the order pipeline/steps/extended.ts lists them. */
const buildExtendedFeatures = (): FeatureVar[] => {
  const out: FeatureVar[] = [];
  for (const r of CODING_REGIONS) for (const b of ["A", "C", "G", "U"]) out.push(fourfold(false, r, b));
  for (const r of HEAVY_REGIONS) for (const b of ["A", "C", "G", "T"]) out.push(fourfold(true, r, b));
  for (const r of CODING_REGIONS) out.push(gravyVar(r));
  for (const r of STRUCTURE_REGIONS) for (const s of REPEAT_SPECS) out.push(structureVar(s, r));
  for (const r of STRUCTURE_REGIONS) for (const s of MOTIF_SPECS) out.push(structureVar(s, r));
  for (const k of CONTACT_KINDS) out.push(contactVar(k));
  out.push(majorArcLength, controlRegions);
  return out;
};

let catalog: { list: Variable[]; byKey: Map<string, Variable> } | null = null;

/** All plottable variables (traits first), built once. */
export const getCatalog = (): { list: Variable[]; byKey: Map<string, Variable> } => {
  if (!catalog) {
    const list: Variable[] = [...TRAIT_SPECS.map(traitVar), ...buildFeatures(), ...buildExtendedFeatures()];
    catalog = { list, byKey: new Map(list.map((v) => [v.key, v])) };
  }
  return catalog;
};

export const FEATURE_KEYS = (): string[] =>
  getCatalog()
    .list.filter((v) => v.kind === "feature")
    .map((v) => v.key);

export const getVariable = (key: string): Variable | undefined => getCatalog().byKey.get(key);

export const isTrait = (v: Variable | undefined): v is TraitVar => v?.kind === "trait";
export const isFeature = (v: Variable | undefined): v is FeatureVar => v?.kind === "feature";

export type ChunkKind = "codon" | "aa" | "ext";

/** True for an extended feature (fourfold sites, hydropathy, repeats and structure). */
export const isExtendedVar = (v: Variable): boolean => v.kind === "feature" && EXTENDED_GROUPS.includes(v.group);

/**
 * Per-gene codon and amino-acid features, and every extended feature, are not in explorer.json:
 * they load in chunks, one per gene and kind (codons, amino acids) or one per region (extended).
 */
export const chunkOf = (v: Variable): { region: VarRegion; kind: ChunkKind } | null => {
  if (v.kind !== "feature") return null;
  if (isExtendedVar(v)) return { region: v.region, kind: "ext" };
  return (v.measure === "codon" || v.measure === "aa") && v.region !== "total_pc" ? { region: v.region, kind: v.measure } : null;
};

/** Axis title: "Max lifespan, years (log)". */
export const axisTitle = (v: Variable, log: boolean): string =>
  `${v.short}${v.unit ? `, ${v.unit}` : ""}${log ? " (log scale)" : ""}`;

export const GROUP_LABEL: Record<VarGroup, string> = {
  trait: "Life history (AnAge)",
  composition: "Size and composition",
  codon: "Codon usage",
  aminoAcid: "Amino acids",
  fourfold: "Fourfold sites",
  hydropathy: "Protein hydropathy",
  structure: "Repeats and structure",
};

/** "Life history", "Size and composition · ND6", "Codon usage · All protein-coding". */
export const variableContext = (v: Variable): string =>
  v.kind === "trait" ? GROUP_LABEL.trait : `${GROUP_LABEL[v.group]} · ${regionPickerLabel(v.region)}`;
