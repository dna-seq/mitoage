/** Small descriptive statistics helpers (pure; safe anywhere). */

/** Quantile of an ascending-sorted array, linear interpolation (type 7, as in R and NumPy). */
export const quantileSorted = (sorted: readonly number[], p: number): number => {
  if (!sorted.length) return Number.NaN;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  return a + (b - a) * (h - lo);
};

export interface Summary {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export const summarize = (values: readonly number[]): Summary => {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0] ?? Number.NaN,
    q1: quantileSorted(s, 0.25),
    median: quantileSorted(s, 0.5),
    q3: quantileSorted(s, 0.75),
    max: s[s.length - 1] ?? Number.NaN,
  };
};

/** Deterministic pseudo-random number in [0, 1) from an integer (for jitter that is stable across builds). */
export const hash01 = (n: number): number => {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
