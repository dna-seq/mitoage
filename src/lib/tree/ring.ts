/**
 * Per-species values shown on the outer ring of the radial tree: scales, ticks and the colour
 * ramp. The ramp runs between theme tokens (--ring-lo/mid/hi, set per metric in tree.css) mixed in
 * OKLab like CSS color-mix(), resolved for the canvas by treeDraw.ts, so the ring follows the light
 * and dark theme. Safe for islands.
 */
import { fmtLifespan, fmtNum } from "~/lib/format";

export type Metric = "life" | "gc" | "size";

export interface RingMetric {
  key: Metric;
  /** Button label. */
  short: string;
  /** Legend title. */
  title: string;
  /** Tooltip / panel label. */
  label: string;
  log: boolean;
}

export const RING_METRICS: readonly RingMetric[] = [
  { key: "life", short: "Lifespan", title: "Maximum lifespan, log scale", label: "Lifespan", log: true },
  { key: "gc", short: "GC %", title: "Whole-genome GC content", label: "GC", log: false },
  { key: "size", short: "mtDNA size", title: "Mitochondrial genome length", label: "mtDNA size", log: false },
];

export const metricInfo = (m: Metric): RingMetric => RING_METRICS.find((x) => x.key === m) ?? (RING_METRICS[0] as RingMetric);

export interface RingTick {
  t: number;
  label: string;
}

export interface RingScale {
  /** Value -> 0..1. */
  norm: (v: number) => number;
  ticks: RingTick[];
  min: number;
  max: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const fmtKb = (bp: number): string => `${fmtNum(bp / 1000, 1)} kb`;

export const ringScale = (metric: Metric, values: readonly number[]): RingScale => {
  const ok = values.filter((v) => Number.isFinite(v) && (metric !== "life" || v > 0));
  const lo = ok.length ? Math.min(...ok) : 1;
  const hi = ok.length ? Math.max(...ok) : 10;
  if (metric === "life") {
    const l0 = Math.log10(lo);
    const l1 = Math.log10(hi);
    const norm = (v: number) => (v > 0 ? clamp01((Math.log10(v) - l0) / (l1 - l0 || 1)) : 0);
    const ticks: RingTick[] = [];
    for (let e = Math.ceil(l0); e <= Math.floor(l1); e++) ticks.push({ t: norm(10 ** e), label: fmtLifespan(10 ** e) });
    return { norm, ticks, min: lo, max: hi };
  }
  // Linear with round end points.
  const step = metric === "gc" ? 5 : 2000;
  const d0 = Math.floor(lo / step) * step;
  const d1 = Math.ceil(hi / step) * step;
  const norm = (v: number) => clamp01((v - d0) / (d1 - d0 || 1));
  const tickStep = metric === "gc" ? 10 : 4000;
  const ticks: RingTick[] = [];
  for (let v = Math.ceil(d0 / tickStep) * tickStep; v <= d1; v += tickStep) {
    ticks.push({ t: norm(v), label: metric === "gc" ? `${fmtNum(v, 0)}%` : fmtKb(v) });
  }
  return { norm, ticks, min: d0, max: d1 };
};

/** Where the middle colour sits on the ramp, per metric (lifespans crowd the upper half). */
export const RAMP_MID: Record<Metric, number> = { life: 0.38, gc: 0.5, size: 0.5 };

// ---------------------------------------------------------------- resolved colours (canvas)

export type Rgb = [number, number, number];

/** Parse a computed CSS colour ("rgb(1, 2, 3)", "rgba(1 2 3 / 0.5)", "#0e4a22"); null if unknown. */
export const parseRgb = (css: string): Rgb | null => {
  const s = css.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1] ?? "";
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const toLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number): number => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055;
  return Math.round(clamp01(c) * 255);
};

/** sRGB (0..255) to OKLab. */
export const rgbToOklab = ([r8, g8, b8]: Rgb): Rgb => {
  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

/** OKLab to sRGB (0..255), clipped. */
export const oklabToRgb = ([L, a, b]: Rgb): Rgb => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

/** Mix like CSS color-mix(in oklab, a (1 − t), b t). */
export const mixOklab = (a: Rgb, b: Rgb, t: number): Rgb => {
  const p = rgbToOklab(a);
  const q = rgbToOklab(b);
  return oklabToRgb([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
};

/** `n` colours of the ring ramp lo -> mid -> hi, the same as rampFill() but as rgb() strings. */
export const rampColors = (lo: Rgb, mid: Rgb, hi: Rgb, midAt = 0.5, n = 101): string[] =>
  Array.from({ length: n }, (_, i) => {
    const k = i / (n - 1);
    const c = k <= midAt ? mixOklab(lo, mid, k / midAt) : mixOklab(mid, hi, (k - midAt) / (1 - midAt));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  });
