/**
 * Chart data for the Compare section. Turns the rows of the comparative tables into the marks of
 * a range chart, a group's summaries into a lifespan-correlation map, codon summaries into
 * stacked rows and species rows into scatter points. Pure functions, safe for islands: the chart
 * components only draw what these return, so the charts and the tables cannot disagree.
 */
import type { Cell, Row } from "~/components/ui/DataTable";
import type { Region } from "~/data/schema";
import { PROTEIN_GENES } from "~/data/schema";
import { classGroup } from "~/lib/classes";
import { fmtCompact, fmtP, fmtR, fmtSignedTick } from "~/lib/explore/format";
import { benjaminiHochberg, correlationCI } from "~/lib/explore/stats";
import { codonAminoAcid } from "~/lib/explore/variables";
import { fmtFixed, fmtInt, fmtLifespan, fmtNum, fmtPct } from "~/lib/format";
import { AA_ORDER, AMINO_ACIDS } from "~/lib/geneticCode";
import type { ScatterPoint } from "~/lib/scatterTypes";
import { fmtParam, fmtSpread, getParam, type Param, PARAM_KEYS, type ParamKey, paramValue, STATS_REGIONS } from "./params";
import { MIN_CORR_N } from "./summary";
import type { GroupCodonsFile, GroupStatsFile } from "./wire";

const num = (v: Cell | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: Cell | undefined): string => (typeof v === "string" ? v : "");

// ---------------------------------------------------------------- what a chart plots

/** What the chart of a comparative table shows on its value axis. */
export type PlotKey = "dist" | "var" | "r" | "map";
/** The plots a range chart can draw (the map is a chart of its own). */
export type RangePlotKey = Exclude<PlotKey, "map">;

export interface Plot {
  key: PlotKey;
  label: string;
  title: string;
}

export const PLOTS: readonly Plot[] = [
  { key: "dist", label: "Distribution", title: "Mean ± SD, median and range of the parameter" },
  { key: "var", label: "Variation", title: "Coefficient of variation (SD / mean); standard deviation for the skews" },
  { key: "r", label: "Lifespan r", title: "Pearson r with log10 maximum lifespan and its 95% confidence interval" },
  { key: "map", label: "Lifespan map", title: "r with log10 maximum lifespan of every parameter in every region" },
];

export const DEFAULT_PLOT: PlotKey = "dist";
export const isPlotKey = (key: string): key is PlotKey => PLOTS.some((p) => p.key === key);
/** A range chart has no map view: there it shows the lifespan correlation. */
export const rangePlotOf = (key: PlotKey): RangePlotKey => (key === "map" ? "r" : key);

// ---------------------------------------------------------------- range chart

/** One row of a range chart. Values are in the units of the axis; a null mark is not drawn. */
export interface RangeMark {
  key: string;
  label: string;
  href: string | null;
  /** Any CSS colour. */
  color: string;
  /** Species behind the row. */
  n: number;
  /** Thin line: the range, or the confidence interval of r. */
  lo: number | null;
  hi: number | null;
  /** Thick bar: mean ± SD, or zero to the value. */
  boxLo: number | null;
  boxHi: number | null;
  /** Vertical tick: the median. */
  tick: number | null;
  /** Dot: the mean, or r. */
  dot: number | null;
  /** Tooltip lines, [name, value]. */
  tip: [string, string][];
  /** Said in place of the marks when the row has nothing to draw. */
  empty: string | null;
}

/**
 * Marks for the rows of a regions or taxa table (see ./rows: label or name, n, mean, sd, cv, min,
 * median, max, r, p). The interval of r takes n as the number of pairs, which holds because every
 * species has a lifespan (checked in charts.test.ts).
 */
export function rangeMarks(
  rows: readonly Row[],
  plot: RangePlotKey,
  param: Param,
  color: (row: Row) => string,
): RangeMark[] {
  return rows.map((row, i) => {
    const label = str(row["label"]) || str(row["name"]);
    const n = num(row["n"]) ?? 0;
    const mean = num(row["mean"]);
    const sd = num(row["sd"]);
    const mark: RangeMark = {
      key: `${i}:${label}`,
      label,
      href: str(row["href"]) || null,
      color: color(row),
      n,
      lo: null,
      hi: null,
      boxLo: null,
      boxHi: null,
      tick: null,
      dot: null,
      tip: [],
      empty: null,
    };
    const species: [string, string] = ["Species", fmtInt(n)];
    if (plot === "dist") {
      if (mean === null) return { ...mark, empty: "no values" };
      const min = num(row["min"]);
      const max = num(row["max"]);
      const median = num(row["median"]);
      return {
        ...mark,
        lo: min,
        hi: max,
        boxLo: sd === null ? null : mean - sd,
        boxHi: sd === null ? null : mean + sd,
        tick: median,
        dot: mean,
        tip: [
          ["Mean", fmtParam(param, mean)],
          ...(sd === null ? [] : [["SD", fmtSpread(param, sd)] as [string, string]]),
          ["Median", fmtParam(param, median)],
          ["Range", `${fmtParam(param, min)} to ${fmtParam(param, max)}`],
          species,
        ],
      };
    }
    if (plot === "var") {
      const v = param.cv ? num(row["cv"]) : sd;
      if (v === null) return { ...mark, empty: n < 2 ? "one species" : "not defined" };
      return {
        ...mark,
        boxLo: 0,
        boxHi: v,
        tip: [
          param.cv ? ["CV", fmtFixed(v, 3)] : ["SD", fmtSpread(param, v)],
          ["Mean", fmtParam(param, mean)],
          ...(param.cv && sd !== null ? [["SD", fmtSpread(param, sd)] as [string, string]] : []),
          species,
        ],
      };
    }
    const r = num(row["r"]);
    if (r === null) return { ...mark, empty: n < MIN_CORR_N ? `fewer than ${MIN_CORR_N} species` : "not defined" };
    const ci = correlationCI(r, n);
    return {
      ...mark,
      lo: ci?.[0] ?? null,
      hi: ci?.[1] ?? null,
      dot: r,
      tip: [
        ["r", fmtR(r, 3)],
        ...(ci ? [["95% CI", `${fmtR(ci[0], 2)} to ${fmtR(ci[1], 2)}`] as [string, string]] : []),
        ["p", fmtP(num(row["p"]))],
        species,
      ],
    };
  });
}

export interface RangeAxis {
  domain: [number, number];
  log: boolean;
  /** Draw a reference line at zero. */
  zero: boolean;
  label: string;
  tick: (v: number) => string;
}

/** A log axis is used for lengths that span more than this ratio (regions from ATP8 to the whole genome). */
const LOG_RATIO = 30;

/**
 * Value axis for a set of marks. r gets a symmetric domain, variation starts at zero, and the
 * distribution of lengths goes to a log scale when `allowLog` and the rows span a wide range.
 */
export function rangeAxis(marks: readonly RangeMark[], plot: RangePlotKey, param: Param, allowLog = false): RangeAxis {
  const of = (pick: (m: RangeMark) => (number | null)[]): number[] =>
    marks.flatMap(pick).filter((v): v is number => v !== null && Number.isFinite(v));
  if (plot === "r") {
    const m = Math.max(0.2, ...of((k) => [k.lo, k.hi, k.dot]).map(Math.abs));
    const lim = Math.min(1, Math.ceil(m * 1.06 * 20) / 20);
    return {
      domain: [-lim, lim],
      log: false,
      zero: true,
      label: "r with log₁₀ lifespan (95% CI)",
      tick: (v) => fmtSignedTick(v, 2),
    };
  }
  if (plot === "var") {
    const hi = Math.max(0, ...of((k) => [k.boxHi]));
    return {
      domain: [0, hi > 0 ? hi * 1.06 : 1],
      log: false,
      zero: true,
      label: param.cv ? `CV of ${param.noun} (SD / mean)` : `SD of ${param.noun}`,
      tick: (v) => fmtNum(v, 3),
    };
  }
  const ends = of((k) => [k.lo, k.hi, k.dot]);
  const tick = param.unit === "%" ? (v: number) => fmtNum(v, 1) : param.unit === "bp" ? fmtCompact : (v: number) => fmtSignedTick(v, 2);
  const title = param.unit === "%" ? `${param.label.replace(" %", "")} content, %` : param.unit === "bp" ? "Length, bp" : param.label;
  if (!ends.length) return { domain: [0, 1], log: false, zero: false, label: title, tick };
  const min = Math.min(...ends);
  const max = Math.max(...ends);
  if (allowLog && param.unit === "bp" && min > 0 && max / min >= LOG_RATIO) {
    return { domain: [min / 1.25, max * 1.25], log: true, zero: false, label: `${title} (log scale)`, tick };
  }
  const all = [...ends, ...of((k) => [k.boxLo, k.boxHi])];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.04;
  lo -= pad;
  hi += pad;
  if (param.unit === "%") {
    lo = Math.max(0, lo);
    hi = Math.min(100, hi);
  }
  if (param.unit === "bp") lo = Math.max(0, lo);
  return { domain: [lo, hi], log: false, zero: param.unit === "" && lo < 0 && hi > 0, label: title, tick };
}

// ---------------------------------------------------------------- row colours

export interface Swatch {
  key: string;
  label: string;
  color: string;
}

/** Colour families of the regions, the same as on the genome map. */
export const REGION_SWATCHES: readonly Swatch[] = [
  { key: "genome", label: "Whole genome", color: "var(--tone-navy-bar)" },
  { key: "cds", label: "Protein-coding", color: "var(--feat-cds)" },
  { key: "rrna", label: "rRNA", color: "var(--feat-rrna)" },
  { key: "trna", label: "tRNA", color: "var(--feat-trna)" },
  { key: "dloop", label: "D-loop", color: "var(--feat-dloop)" },
];

export const regionSwatchKey = (region: string): string => {
  if (region === "total_mtDNA") return "genome";
  if (region === "total_pc" || (PROTEIN_GENES as readonly string[]).includes(region)) return "cds";
  if (region === "total_tRNA") return "trna";
  if (region === "D_Loop") return "dloop";
  return "rrna";
};

export const regionColor = (region: string): string =>
  REGION_SWATCHES.find((s) => s.key === regionSwatchKey(region))?.color ?? "var(--chart-point-muted)";

// ---------------------------------------------------------------- lifespan-correlation map

/** Parameters of the map. AT % is left out: it is 100 − GC %, so its r is that of GC % with the opposite sign. */
export const MAP_PARAMS: readonly ParamKey[] = PARAM_KEYS.filter((k) => k !== "at");
/** |r| at which a cell reaches its full colour. */
export const MAP_R_LIMIT = 0.6;
/** Cells with a q-value below this are marked. */
export const MAP_Q = 0.05;

export interface CorrCell {
  n: number;
  r: number | null;
  /** Two-tailed p of r, as in the tables. */
  p: number | null;
  /** Benjamini-Hochberg q over every correlation of the map. */
  q: number | null;
}

export interface CorrMapData {
  regions: Region[];
  params: ParamKey[];
  /** cells[regionIndex][paramIndex] */
  cells: CorrCell[][];
  /** Number of correlations the q-values are corrected over. */
  tests: number;
}

/** r of every parameter with log10 lifespan in every region of a group, with q-values over the whole map. */
export function corrMap(file: GroupStatsFile): CorrMapData {
  const regions = STATS_REGIONS.filter((r) => file.stats[r]);
  const cells = regions.map((region) =>
    MAP_PARAMS.map((key): CorrCell => {
      const t = file.stats[region]?.[key];
      return { n: t?.[0] ?? 0, r: t?.[8] ?? null, p: t?.[9] ?? null, q: null };
    }),
  );
  const flat = cells.flat();
  const q = benjaminiHochberg(flat.map((c) => (c.r === null ? null : c.p)));
  let tests = 0;
  flat.forEach((c, i) => {
    const v = q[i];
    if (v !== undefined && Number.isFinite(v)) {
      c.q = v;
      tests++;
    }
  });
  return { regions: [...regions], params: [...MAP_PARAMS], cells, tests };
}

/** Colour strength of a cell, 0 to 1. */
export const corrShade = (r: number | null): number => (r === null ? 0 : Math.min(1, Math.abs(r) / MAP_R_LIMIT));

/** r for a narrow cell, without the leading zero: "−.21", ".05", "1.00". */
export const fmtRShort = (r: number | null): string => {
  if (r === null || !Number.isFinite(r)) return "–";
  const s = Math.abs(r).toFixed(2);
  const body = s.startsWith("0.") ? s.slice(1) : s;
  return r < 0 && Number(s) !== 0 ? `−${body}` : body;
};

// ---------------------------------------------------------------- codon usage

export type Base = "a" | "c" | "g" | "t";

export interface CodonSeg {
  /** RNA codon as in the data, "CUA". */
  codon: string;
  /** The same on DNA, "CTA". */
  dna: string;
  /** Third base, for the segment's colour. */
  third: Base;
  n: number;
  /** Mean share of all codons, %. */
  mean: number;
  sd: number | null;
  min: number | null;
  max: number | null;
  /** Share of the amino acid's summed mean usage, 0 to 1. */
  share: number;
}

export interface CodonBarRow {
  /** Three-letter amino acid, or "Stop". */
  aa: string;
  name: string;
  /** Sum of the codons' mean usage, % of all codons. */
  total: number;
  segs: CodonSeg[];
}

const THIRD_ORDER: readonly Base[] = ["a", "t", "g", "c"];
const AA_NAME = new Map(Object.values(AMINO_ACIDS).map((a) => [a.three, a.name]));
const AA_RANK = new Map(AA_ORDER.map((letter, i) => [AMINO_ACIDS[letter]?.three ?? letter, i]));

/**
 * Codon usage of one gene (or all protein-coding genes) as one row per amino acid under the
 * vertebrate mitochondrial code, its codons as segments ordered by third base (A, T, G, C).
 * Rows are sorted by total usage, stop codons last.
 */
export function codonBarRows(file: GroupCodonsFile, region: Region): CodonBarRow[] {
  const ri = file.regions.indexOf(region);
  if (ri < 0) return [];
  const tuples = file.codon[ri] ?? [];
  const byAa = new Map<string, CodonSeg[]>();
  file.codons.forEach((codon, i) => {
    const t = tuples[i];
    if (!t || t[0] === 0 || t[1] === null) return;
    const dna = codon.replace(/U/g, "T");
    const third = dna[2]?.toLowerCase();
    if (third !== "a" && third !== "c" && third !== "g" && third !== "t") return;
    const aa = codonAminoAcid(codon);
    const seg: CodonSeg = { codon, dna, third, n: t[0], mean: t[1], sd: t[2], min: t[3], max: t[5], share: 0 };
    (byAa.get(aa) ?? byAa.set(aa, []).get(aa)!).push(seg);
  });
  const rows = [...byAa.entries()].map(([aa, segs]): CodonBarRow => {
    const total = segs.reduce((s, x) => s + x.mean, 0);
    segs.sort(
      (a, b) => THIRD_ORDER.indexOf(a.third) - THIRD_ORDER.indexOf(b.third) || (a.codon < b.codon ? -1 : a.codon > b.codon ? 1 : 0),
    );
    for (const s of segs) s.share = total > 0 ? s.mean / total : 0;
    return { aa, name: AA_NAME.get(aa) ?? aa, total, segs };
  });
  const stop = (r: CodonBarRow) => (r.aa === "Stop" ? 1 : 0);
  return rows.sort(
    (a, b) => stop(a) - stop(b) || b.total - a.total || (AA_RANK.get(a.aa) ?? 99) - (AA_RANK.get(b.aa) ?? 99),
  );
}

// ---------------------------------------------------------------- species scatter

export type ScatterAxisKey = ParamKey | "lifespan";

export interface ScatterAxis {
  key: ScatterAxisKey;
  /** Option label: "Maximum lifespan", "GC %". */
  label: string;
  /** Axis title: "Maximum lifespan (log scale)", "GC content, %". */
  title: string;
  log: boolean;
  tick: (v: number) => string;
  value: (v: number) => string;
}

const paramAxis = (key: ParamKey): ScatterAxis => {
  const p = getParam(key);
  return {
    key,
    label: p.label,
    title: p.unit === "%" ? `${p.label.replace(" %", "")} content, %` : p.unit === "bp" ? "Length, bp" : p.label,
    log: false,
    tick: p.unit === "%" ? (v) => fmtNum(v, 1) : p.unit === "bp" ? fmtCompact : (v) => fmtSignedTick(v, 2),
    // Named, so the two values of a tooltip can be told apart: "GC 41.82%", "GC skew −0.214".
    value:
      p.unit === "%"
        ? (v) => `${p.label.replace(" %", "")} ${fmtPct(v, 2)}`
        : p.unit === "bp"
          ? (v) => `${fmtInt(v)} bp`
          : (v) => `${p.label} ${fmtSignedTick(v, 3)}`,
  };
};

/** What either axis of the species scatter can show: lifespan and the parameters of the region. */
export const SCATTER_AXES: readonly ScatterAxis[] = [
  {
    key: "lifespan",
    label: "Maximum lifespan",
    title: "Maximum lifespan (log scale)",
    log: true,
    tick: (v) => (v < 1 ? `${fmtNum(v, 2)} yr` : `${fmtNum(v, 0)} yr`),
    value: fmtLifespan,
  },
  ...PARAM_KEYS.map(paramAxis),
];

export const DEFAULT_SCATTER_X: ScatterAxisKey = "lifespan";
export const DEFAULT_SCATTER_Y: ScatterAxisKey = "gc";
export const isScatterAxisKey = (key: string): key is ScatterAxisKey => SCATTER_AXES.some((a) => a.key === key);
export const getScatterAxis = (key: string): ScatterAxis => SCATTER_AXES.find((a) => a.key === key) ?? SCATTER_AXES[0]!;

/** Value of an axis for one row of the species table (see speciesRows in ./rows). */
export function speciesAxisValue(row: Row, key: ScatterAxisKey): number | null {
  if (key === "lifespan") {
    const l = num(row["lifespan"]);
    return l !== null && l > 0 ? l : null;
  }
  const a = num(row["a"]);
  const c = num(row["c"]);
  const g = num(row["g"]);
  const t = num(row["t"]);
  const length = num(row["length"]);
  if (a === null || c === null || g === null || t === null || length === null) return null;
  return paramValue({ lengthBp: length, a, c, g, t, gcSkew: num(row["gcSkew"]), atSkew: num(row["atSkew"]) }, key);
}

export interface SpeciesScatter {
  points: ScatterPoint[];
  /** The plotted values as the statistics see them: log10 on a log axis, aligned with `points`. */
  tx: number[];
  ty: number[];
}

/** Points for the species that have both values (and a positive value on a log axis). */
export function speciesScatter(rows: readonly Row[], x: ScatterAxis, y: ScatterAxis): SpeciesScatter {
  const out: SpeciesScatter = { points: [], tx: [], ty: [] };
  for (const row of rows) {
    const vx = speciesAxisValue(row, x.key);
    const vy = speciesAxisValue(row, y.key);
    if (vx === null || vy === null || (x.log && vx <= 0) || (y.log && vy <= 0)) continue;
    const href = str(row["href"]);
    const point: ScatterPoint = {
      id: href || str(row["name"]),
      x: vx,
      y: vy,
      group: classGroup(str(row["className"])),
      label: str(row["name"]),
    };
    const common = str(row["common"]);
    if (common) point.sub = common;
    if (href) point.href = href;
    out.points.push(point);
    out.tx.push(x.log ? Math.log10(vx) : vx);
    out.ty.push(y.log ? Math.log10(vy) : vy);
  }
  return out;
}
