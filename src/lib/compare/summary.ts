/**
 * Descriptive statistics for the comparative tables. Pure functions, safe for islands; used at
 * build time for the precomputed tables and in the browser for regrouped ones.
 */
import { correlationP, pearson } from "~/lib/explore/stats";

export interface Summary {
  n: number;
  mean: number;
  /** Sample standard deviation (n − 1); NaN for fewer than 2 values. */
  sd: number;
  min: number;
  /** Index (into the input) of the minimum and maximum; -1 when empty. */
  minAt: number;
  median: number;
  max: number;
  maxAt: number;
}

const EMPTY: Summary = {
  n: 0,
  mean: Number.NaN,
  sd: Number.NaN,
  min: Number.NaN,
  minAt: -1,
  median: Number.NaN,
  max: Number.NaN,
  maxAt: -1,
};

/** Summary of the finite values; null, undefined and NaN are skipped. */
export function summarize(values: ArrayLike<number | null | undefined>): Summary {
  const xs: number[] = [];
  let min = Infinity;
  let max = -Infinity;
  let minAt = -1;
  let maxAt = -1;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    xs.push(v);
    sum += v;
    if (v < min) {
      min = v;
      minAt = i;
    }
    if (v > max) {
      max = v;
      maxAt = i;
    }
  }
  const n = xs.length;
  if (n === 0) return { ...EMPTY };
  const mean = sum / n;
  let ss = 0;
  for (const x of xs) ss += (x - mean) * (x - mean);
  xs.sort((a, b) => a - b);
  const mid = n >> 1;
  const median = n % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
  return { n, mean, sd: n > 1 ? Math.sqrt(ss / (n - 1)) : Number.NaN, min, minAt, median, max, maxAt };
}

/** Coefficient of variation, SD / |mean|; NaN when the mean is 0 or the SD is undefined. */
export const coefVar = (s: Pick<Summary, "mean" | "sd">): number =>
  Number.isFinite(s.sd) && Number.isFinite(s.mean) && s.mean !== 0 ? s.sd / Math.abs(s.mean) : Number.NaN;

/** Below this many species a correlation with lifespan is not reported. */
export const MIN_CORR_N = 5;

/**
 * Pearson r of a parameter with log10 maximum lifespan, and its two-tailed p-value.
 * Pairs with a missing value or a non-positive lifespan are skipped.
 */
export function lifespanCorrelation(
  values: ArrayLike<number | null | undefined>,
  lifespans: ArrayLike<number | null | undefined>,
): { r: number; p: number; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const l = lifespans[i];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    if (l === null || l === undefined || !(l > 0)) continue;
    xs.push(v);
    ys.push(Math.log10(l));
  }
  const n = xs.length;
  if (n < MIN_CORR_N) return { r: Number.NaN, p: Number.NaN, n };
  const r = pearson(xs, ys);
  return { r, p: correlationP(r, n), n };
}

/** Round for JSON: keeps `digits` significant decimals and turns NaN into null. */
export const roundOrNull = (v: number, digits: number): number | null => {
  if (!Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** Significant-figure rounding for p-values: 3 significant digits, NaN to null. */
export const roundP = (p: number): number | null => (Number.isFinite(p) ? Number(p.toPrecision(3)) : null);
