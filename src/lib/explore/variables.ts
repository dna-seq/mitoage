/**
 * Everything the plot explorer can put on an axis: 11 life-history traits and the 1,257 mtDNA
 * features of the pipeline (size, GC%, skews per region; codon and amino-acid frequencies per
 * protein-coding region). Labels, units, default log scale and formatters live here.
 * No data imports: safe for islands. The page checks at build time that FEATURE_KEYS matches the
 * pipeline's feature list exactly.
 */
import { AGGREGATE_REGIONS, PROTEIN_GENES, type Region, type TraitKey } from "~/data/schema";
import { fmtBp, fmtDays, fmtKelvinAsCelsius, fmtLifespan, fmtMass, fmtNum, fmtPct, fmtSigned } from "~/lib/format";
import { REGION_INFO } from "~/lib/genes";
import { AMINO_ACIDS, CODONS, VERTEBRATE_MITO } from "~/lib/geneticCode";
import { fmtCompact, fmtSignedTick } from "./format";

export type Measure = "size" | "noncoding" | "gc" | "gcSkew" | "atSkew" | "codon" | "aa";
export type VarGroup = "trait" | "composition" | "codon" | "aminoAcid";

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
  region: Region;
  /** Codon ("CUA") or amino-acid letter ("L") for codon and aa features. */
  sub: string | null;
}

export type Variable = TraitVar | FeatureVar;

// ---------------------------------------------------------------- regions

/** Regions in picker order: whole genome and gene sets first, then genes in genome order. */
export const REGION_ORDER: readonly Region[] = [...AGGREGATE_REGIONS, ...PROTEIN_GENES];

/** Regions that have codon and amino-acid features. */
export const CODING_REGIONS: readonly Region[] = ["total_pc", ...PROTEIN_GENES];

/** Short region name for axis titles. */
export const regionShort = (r: Region): string => {
  switch (r) {
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
export const regionPhrase = (r: Region): string => {
  switch (r) {
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
export const regionPickerLabel = (r: Region): string => {
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

const regionWords = (r: Region): string => {
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
        label: `${gc ? "GC" : "AT"} skew of ${rp}`,
        short: `${rs} ${gc ? "GC" : "AT"} skew`,
        unit: "",
        group: "composition",
        tick: (v) => fmtSignedTick(v, 2),
        value: (v) => fmtSigned(v, 3),
        search: `${gc ? "gc skew gcskew g-c" : "at skew atskew a-t"} strand asymmetry ${regionWords(region)}`.toLowerCase(),
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

let catalog: { list: Variable[]; byKey: Map<string, Variable> } | null = null;

/** All plottable variables (traits first), built once. */
export const getCatalog = (): { list: Variable[]; byKey: Map<string, Variable> } => {
  if (!catalog) {
    const list: Variable[] = [...TRAIT_SPECS.map(traitVar), ...buildFeatures()];
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

/** Per-gene codon and amino-acid features are not in explorer.json; they load in per-gene chunks. */
export const chunkOf = (v: Variable): { region: Region; kind: "codon" | "aa" } | null =>
  v.kind === "feature" && (v.measure === "codon" || v.measure === "aa") && v.region !== "total_pc"
    ? { region: v.region, kind: v.measure }
    : null;

/** Axis title: "Max lifespan, years (log)". */
export const axisTitle = (v: Variable, log: boolean): string =>
  `${v.short}${v.unit ? `, ${v.unit}` : ""}${log ? " (log scale)" : ""}`;

export const GROUP_LABEL: Record<VarGroup, string> = {
  trait: "Life history (AnAge)",
  composition: "Size and composition",
  codon: "Codon usage",
  aminoAcid: "Amino acids",
};

/** "Life history", "Size and composition · ND6", "Codon usage · All protein-coding". */
export const variableContext = (v: Variable): string =>
  v.kind === "trait" ? GROUP_LABEL.trait : `${GROUP_LABEL[v.group]} · ${regionPickerLabel(v.region)}`;
