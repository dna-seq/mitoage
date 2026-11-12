/**
 * Per-species values shown on the outer ring of the radial tree: scales, ticks and the colour
 * ramp. Colours are CSS colour-mix() expressions over theme tokens (--ring-lo/mid/hi, set per
 * metric in RadialTree.css), so the ring follows the light and dark theme. Safe for islands.
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

/** Fill for a normalised value: --ring-lo -> --ring-mid -> --ring-hi, mixed in OKLab. */
export const rampFill = (t: number, mid = 0.5): string => {
  const k = clamp01(t);
  if (k <= mid) return `color-mix(in oklab, var(--ring-mid) ${Math.round((k / mid) * 100)}%, var(--ring-lo))`;
  return `color-mix(in oklab, var(--ring-hi) ${Math.round(((k - mid) / (1 - mid)) * 100)}%, var(--ring-mid))`;
};
