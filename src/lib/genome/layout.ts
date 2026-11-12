/**
 * Geometry of the circular mitochondrial genome map: feature arcs with arrow ends, in-arc and
 * outer labels, tRNA letters, the kb scale and the GC% ring. Pure functions of the features,
 * so the server render and the hydrated island produce the same SVG. Safe for islands.
 *
 * Coordinates: viewBox "-360 -360 720 720", origin at the centre; angles in radians, measured
 * clockwise from 12 o'clock, so RefSeq coordinates run clockwise from the top.
 *
 * Two label sets are computed: "wide" (map drawn at 560 px or more: outer labels with leader
 * lines, small type) and "narrow" (phones: the map is cropped to the rings and only labels
 * that fit inside their arcs are kept, in larger type). CSS container queries pick one.
 */
import type { FeatureType } from "~/data/schema";
import { mapLabel } from "./names";

export interface MapFeature {
  name: string;
  type: FeatureType;
  /** 1-based inclusive; start > end wraps the origin. */
  start: number;
  end: number;
  strand: 1 | -1;
}

/** Half the viewBox size. */
export const VIEW = 360;
/** Radius kept visible in narrow mode (the SVG is scaled up so this fills the frame). */
export const NARROW_VIEW = 290;

/** Radii of the rings, outermost first. */
export const R = {
  outerLabel: 300,
  elbow: 285,
  leaderStart: 268,
  letterPlus: 278,
  plusOut: 264,
  plusIn: 236,
  backbone: 234,
  minusOut: 232,
  minusIn: 204,
  letterMinus: 192,
  scale: 178,
  tickMinor: 173,
  tickMajor: 169,
  tickLabel: 155,
  gcOut: 142,
  gcMid: 120,
  gcIn: 98,
  centre: 92,
} as const;

/**
 * GC ring: each gene's GC% as a bar from the whole-genome GC% (the dashed baseline), outwards
 * when the gene is GC-richer and inwards when it is AT-richer. GC_SPAN percentage points fill
 * the full bar height; larger differences are clipped.
 */
export const GC_SPAN = 6;

const TAU = Math.PI * 2;
const HEAD = 9;

const rn = (n: number): number => Math.round(n * 100) / 100;
const r2 = (n: number): string => String(rn(n));
const pt = (r: number, a: number): string => `${r2(r * Math.sin(a))} ${r2(-r * Math.cos(a))}`;
const xy = (r: number, a: number): [number, number] => [rn(r * Math.sin(a)), rn(-r * Math.cos(a))];
const large = (span: number): number => (span > Math.PI ? 1 : 0);
const norm = (a: number): number => ((a % TAU) + TAU) % TAU;

/** Rough advance width of bold Nunito text in user units. */
export const textWidth = (s: string, fs: number): number => {
  let w = 0;
  for (const ch of s) {
    if (/[A-Z0-9]/.test(ch)) w += 0.64;
    else if (/[a-z]/.test(ch)) w += 0.54;
    else if (ch === " ") w += 0.28;
    else w += 0.38;
  }
  return w * fs;
};

/** Annular sector from a0 to a1 (a1 > a0), with an arrow tip at the end (dir 1), start (-1) or none (0). */
export const sectorPath = (r0: number, r1: number, a0: number, a1: number, dir: 1 | -1 | 0 = 0, head = HEAD): string => {
  const span = Math.min(a1 - a0, TAU - 1e-3);
  a1 = a0 + span;
  const rm = (r0 + r1) / 2;
  const ha = dir === 0 ? 0 : Math.min(head / rm, span * 0.55);
  if (ha <= 0) {
    return `M${pt(r1, a0)}A${r1} ${r1} 0 ${large(span)} 1 ${pt(r1, a1)}L${pt(r0, a1)}A${r0} ${r0} 0 ${large(span)} 0 ${pt(r0, a0)}Z`;
  }
  if (dir === 1) {
    const b = a1 - ha;
    const s = b - a0;
    return `M${pt(r1, a0)}A${r1} ${r1} 0 ${large(s)} 1 ${pt(r1, b)}L${pt(rm, a1)}L${pt(r0, b)}A${r0} ${r0} 0 ${large(s)} 0 ${pt(r0, a0)}Z`;
  }
  const b = a0 + ha;
  const s = a1 - b;
  return `M${pt(rm, a0)}L${pt(r1, b)}A${r1} ${r1} 0 ${large(s)} 1 ${pt(r1, a1)}L${pt(r0, a1)}A${r0} ${r0} 0 ${large(s)} 0 ${pt(r0, b)}Z`;
};

/** Arc path for a textPath, running so that text reads upright at the arc's middle. */
const textArcPath = (r: number, a0: number, a1: number): { d: string; bottom: boolean } => {
  const mid = norm((a0 + a1) / 2);
  const bottom = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2;
  const span = a1 - a0;
  return bottom
    ? { d: `M${pt(r, a1)}A${r} ${r} 0 ${large(span)} 0 ${pt(r, a0)}`, bottom }
    : { d: `M${pt(r, a0)}A${r} ${r} 0 ${large(span)} 1 ${pt(r, a1)}`, bottom };
};

export interface FeatureGeom {
  /** Index into the input features. */
  i: number;
  a0: number;
  a1: number;
  /** Middle angle, normalised to [0, 2π). */
  mid: number;
  r0: number;
  r1: number;
  dir: 1 | -1 | 0;
  d: string;
  label: string;
}

export interface ArcLabel {
  i: number;
  d: string;
  text: string;
  fs: number;
}

export interface OuterLabel {
  i: number;
  text: string;
  x: number;
  y: number;
  anchor: "start" | "end";
  leader: string;
}

export interface Letter {
  i: number;
  text: string;
  x: number;
  y: number;
  fs: number;
}

export interface TickLabel {
  text: string;
  x: number;
  y: number;
  origin: boolean;
}

export interface GcBar {
  i: number;
  d: string;
  /** GC% of the gene minus the whole genome, in percentage points. */
  dev: number;
}

export interface GenomeLayout {
  /** Draw order: D-loop first, then the rest by start. */
  arcs: FeatureGeom[];
  gcBars: GcBar[];
  /** Radii of faint guide circles at ±GC_SPAN/2 points. */
  gcGrid: number[];
  inArc: { wide: ArcLabel[]; narrow: ArcLabel[] };
  outer: OuterLabel[];
  letters: { wide: Letter[]; narrow: Letter[] };
  ticks: { minor: string; major: string; wide: TickLabel[]; narrow: TickLabel[] };
  origin: string;
}

/** Radius at which a GC difference (percentage points from the genome) ends. */
export const gcRadius = (dev: number): number => {
  const amp = R.gcOut - R.gcMid;
  const h = Math.max(-1, Math.min(1, dev / GC_SPAN)) * amp;
  // Keep a hairline for genes right at the genome average.
  return R.gcMid + (Math.abs(h) < 1.5 ? (h < 0 ? -1.5 : 1.5) : h);
};

/** Angles of a feature: start of its first base to the end of its last base, wrapping kept continuous. */
export const featureAngles = (f: MapFeature, sizeBp: number): [number, number] => {
  const a0 = (TAU * (f.start - 1)) / sizeBp;
  let a1 = (TAU * f.end) / sizeBp;
  if (f.start > f.end) a1 += TAU;
  return [a0, a1];
};

const trackOf = (f: MapFeature): [number, number] => {
  if (f.type === "D-loop") return [R.minusIn, R.plusOut];
  return f.strand === 1 ? [R.plusIn, R.plusOut] : [R.minusIn, R.minusOut];
};

/** In-arc label for one feature at one font size, or null when it does not fit. */
const fitInArc = (g: FeatureGeom, fs: number, pad: number): ArcLabel | null => {
  const rm = (g.r0 + g.r1) / 2;
  const ha = g.dir === 0 ? 0 : Math.min(HEAD / rm, (g.a1 - g.a0) * 0.55);
  const b0 = g.dir === -1 ? g.a0 + ha : g.a0;
  const b1 = g.dir === 1 ? g.a1 - ha : g.a1;
  const need = textWidth(g.label, fs) + pad;
  if ((b1 - b0) * rm < need) return null;
  // Text sits on a baseline offset so that its x-height is centred in the track.
  const probe = textArcPath(rm, b0, b1);
  const rb = probe.bottom ? rm + fs * 0.34 : rm - fs * 0.34;
  return { i: g.i, d: textArcPath(rb, b0, b1).d, text: g.label, fs };
};

/** Spread labels on one side so neighbours are at least `gap` apart vertically. */
const relax = (ys: number[], gap: number, lo: number, hi: number): number[] => {
  const out = [...ys];
  for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k]!, out[k - 1]! + gap);
  const over = (out[out.length - 1] ?? 0) - hi;
  if (over > 0) for (let k = out.length - 1; k >= 0; k--) out[k] = Math.min(out[k]!, hi - (out.length - 1 - k) * gap);
  for (let k = 0; k < out.length; k++) out[k] = Math.max(out[k]!, lo + k * gap);
  return out;
};

const outerLabels = (items: FeatureGeom[], fs: number): OuterLabel[] => {
  const gap = fs + 5;
  const out: OuterLabel[] = [];
  for (const side of [1, -1] as const) {
    const mine = items
      .filter((g) => (side === 1 ? g.mid <= Math.PI : g.mid > Math.PI))
      .map((g) => ({ g, y: -R.outerLabel * Math.cos(g.mid) }))
      .sort((a, b) => a.y - b.y);
    const ys = relax(
      mine.map((m) => m.y),
      gap,
      -VIEW + fs,
      VIEW - fs,
    );
    mine.forEach((m, k) => {
      const y = ys[k]!;
      const x = side * Math.max(Math.sqrt(Math.max(0, R.outerLabel ** 2 - y * y)), 24);
      const [sx, sy] = xy(R.leaderStart, m.g.mid);
      const [ex, ey] = xy(R.elbow, m.g.mid);
      out.push({
        i: m.g.i,
        text: m.g.label,
        x: rn(x + side * 4),
        y: rn(y),
        anchor: side === 1 ? "start" : "end",
        leader: `M${r2(sx)} ${r2(sy)}L${r2(ex)} ${r2(ey)}L${r2(x)} ${r2(y)}`,
      });
    });
  }
  return out;
};

/** tRNA letters: greedily keep each letter that does not crowd its placed neighbours or a leader line. */
const placeLetters = (geoms: FeatureGeom[], fs: number, blocked: number[]): Letter[] => {
  const out: Letter[] = [];
  for (const [strand, r] of [
    [1, R.letterPlus],
    [-1, R.letterMinus],
  ] as const) {
    const mine = geoms.filter((g) => (g.dir === 0 ? false : g.dir === strand)).sort((a, b) => a.mid - b.mid);
    const placed: { mid: number; w: number }[] = [];
    for (const g of mine) {
      const w = textWidth(g.label, fs);
      const clear = (m: number, mw: number) => {
        let d = Math.abs(m - g.mid);
        d = Math.min(d, TAU - d);
        return d * r >= (mw + w) / 2 + 2.5;
      };
      if (!placed.every((p) => clear(p.mid, p.w))) continue;
      if (strand === 1 && !blocked.every((b) => clear(b, 5))) continue;
      placed.push({ mid: g.mid, w });
      const [x, y] = xy(r, g.mid);
      out.push({ i: g.i, text: g.label, x, y, fs });
    }
  }
  return out;
};

const tickLabels = (sizeBp: number, r: number, fs: number, every: number): TickLabel[] => {
  const out: TickLabel[] = [];
  const minGap = textWidth("00 kb", fs) * 0.9;
  for (let bp = 0; bp < sizeBp; bp += every) {
    const a = (TAU * bp) / sizeBp;
    // Keep the last labels clear of the "0" at the origin.
    if (bp > 0 && (TAU - a) * r < minGap) continue;
    const [x, y] = xy(r, a);
    out.push({ text: bp === 0 ? "0" : `${bp / 1000} kb`, x, y, origin: bp === 0 });
  }
  return out;
};

/**
 * Lay out a genome map. `gc` maps region names (ND1, rRNA-12S, D_Loop ...) to GC%;
 * features without a value get no GC bar.
 */
export const layoutGenome = (
  features: readonly MapFeature[],
  sizeBp: number,
  gc: Readonly<Record<string, number>>,
  genomeGc: number | null,
): GenomeLayout => {
  if (genomeGc !== null && !Number.isFinite(genomeGc)) genomeGc = null;
  const size = Math.max(1, sizeBp);
  const geoms: FeatureGeom[] = features.map((f, i) => {
    let [a0, a1] = featureAngles(f, size);
    const [r0, r1] = trackOf(f);
    const rm = (r0 + r1) / 2;
    const minSpan = 1.6 / rm;
    if (a1 - a0 < minSpan) {
      const c = (a0 + a1) / 2;
      a0 = c - minSpan / 2;
      a1 = c + minSpan / 2;
    }
    const dir: 1 | -1 | 0 = f.type === "D-loop" ? 0 : f.strand;
    return {
      i,
      a0,
      a1,
      mid: norm((a0 + a1) / 2),
      r0,
      r1,
      dir,
      d: sectorPath(r0, r1, a0, a1, dir),
      label: mapLabel(f.name, f.type),
    };
  });

  const typeOf = (g: FeatureGeom) => features[g.i]!.type;
  const arcs = [...geoms].sort((a, b) => {
    const da = typeOf(a) === "D-loop" ? 0 : 1;
    const db = typeOf(b) === "D-loop" ? 0 : 1;
    return da - db || a.a0 - b.a0;
  });

  const major = geoms.filter((g) => typeOf(g) !== "tRNA");
  const trnas = geoms.filter((g) => typeOf(g) === "tRNA");

  // Wide: in-arc at 14 (or 12), else outside with a leader line.
  const wideIn: ArcLabel[] = [];
  const needOuter: FeatureGeom[] = [];
  for (const g of major) {
    const l = fitInArc(g, 14, 10) ?? fitInArc(g, 12, 6);
    if (l) wideIn.push(l);
    else needOuter.push(g);
  }
  const outer = outerLabels(needOuter, 13);
  const narrowIn = major.map((g) => fitInArc(g, 21, 6)).filter((l): l is ArcLabel => l !== null);

  const blocked = needOuter.map((g) => g.mid);
  const letters = {
    wide: placeLetters(trnas, 11, blocked),
    narrow: placeLetters(trnas, 16, []),
  };

  let minor = "";
  let majorTicks = "";
  for (let bp = 0; bp < size; bp += 1000) {
    const a = (TAU * bp) / size;
    const isMajor = bp % 5000 === 0;
    const seg = `M${pt(R.scale, a)}L${pt(isMajor ? R.tickMajor : R.tickMinor, a)}`;
    if (isMajor) majorTicks += seg;
    else minor += seg;
  }

  const gcBars: GcBar[] = [];
  for (const g of geoms) {
    const f = features[g.i]!;
    const v = gc[f.name];
    if (f.type === "tRNA" || v === undefined || !Number.isFinite(v) || genomeGc === null) continue;
    const dev = v - genomeGc;
    const r = gcRadius(dev);
    gcBars.push({ i: g.i, d: sectorPath(Math.min(R.gcMid, r), Math.max(R.gcMid, r), g.a0, g.a1, 0), dev });
  }

  return {
    arcs,
    gcBars,
    gcGrid: [-GC_SPAN / 2, GC_SPAN / 2].map(gcRadius),
    inArc: { wide: wideIn, narrow: narrowIn },
    outer,
    letters,
    ticks: {
      minor,
      major: majorTicks,
      wide: tickLabels(size, R.tickLabel, 11, 2000),
      narrow: tickLabels(size, R.tickLabel - 3, 16, size > 20000 ? 4000 : 2000),
    },
    origin: `M${pt(R.gcIn, 0)}L${pt(R.plusOut + 6, 0)}`,
  };
};

/** Length in bp of a feature, counting across the origin. */
export const featureLength = (f: MapFeature, sizeBp: number): number =>
  f.start <= f.end ? f.end - f.start + 1 : sizeBp - f.start + 1 + f.end;
