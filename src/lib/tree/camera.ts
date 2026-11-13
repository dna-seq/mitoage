/**
 * Camera for the zoomable radial tree: how the radial layout (layout.ts) is placed on the screen,
 * how a clade is fitted into the view, which clade is in view, and what lies under a point.
 * Pure functions; safe for islands and tests.
 *
 * Screen space is CSS pixels of the canvas. The tree centre sits at (x, y). A node at layout angle
 * `a` (radians clockwise from 12 o'clock) and normalised radius `r` is drawn at screen angle a + th
 * and screen radius T - (1 - r) * D: T = R * k is the radius of the tips (R is the tip radius at
 * k = 1) and D the distance from the tips to the centre of the layout, which equals T except in the
 * rank layout at deep zoom, where ranks never sit more than `step` px apart (the centre opens up
 * instead), so a genus and its family stay on screen with readable species names. Everything
 * outside the tips (the value ring, the clade arcs, the labels) is measured in screen pixels from
 * the tips, so it keeps its size while the tree grows: that is the semantic part of the zoom.
 *
 * The camera matches a d3-zoom transform {k, x, y} applied after rotating the world by th.
 */
import type { Layout, LayoutMode, Pose } from "./layout";
import { SPECIES_DEPTH, type TNode, type TreeModel } from "./types";

export interface Camera {
  k: number;
  /** Screen position of the tree centre. */
  x: number;
  y: number;
  /** Rotation, radians clockwise. */
  th: number;
}

export interface Viewport {
  w: number;
  h: number;
}

/** Fixed-size parts of the drawing for one canvas size, in CSS px. */
export interface Geometry {
  /** UI scale (root font size / 16). */
  u: number;
  /** Smaller side of the viewport. */
  S: number;
  compact: boolean;
  /** Label font size. */
  fs: number;
  /** Tip radius at k = 1. */
  R: number;
  ringGap: number;
  ringH0: number;
  arcGap: number;
  arcW: number;
  labGap: number;
  /** Room for clade names outside the arcs at k = 1 (includes labGap). */
  bandRoom: number;
  /** Widest one-line and two-line species label. */
  w1: number;
  w2: number;
  /** Margin kept free around a fitted clade. */
  pad: number;
  /** Largest distance between rank rings in the rank layout, px. */
  step: number;
}

const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const smoothstep = (e0: number, e1: number, v: number): number => {
  const t = clamp((v - e0) / (e1 - e0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Angle in [0, 2π). */
export const normAngle = (a: number): number => ((a % TAU) + TAU) % TAU;

/** Signed shortest difference b − a in (−π, π]. */
export const angleDiff = (a: number, b: number): number => {
  const d = normAngle(b - a);
  return d > Math.PI ? d - TAU : d;
};

export const geometryFor = (vp: Viewport, u: number): Geometry => {
  const S = Math.min(vp.w, vp.h);
  const compact = S / u < 520;
  const fs = (compact ? 11.5 : 12.5) * u;
  const bandRoom = (compact ? 17 : 19) * u;
  const arcW = (compact ? 6 : 7) * u;
  const arcGap = 5 * u;
  const labGap = 4 * u;
  const ringGap = 6 * u;
  const ringH0 = clamp(S * 0.07, 18 * u, 54 * u);
  const R = Math.max(12 * u, S / 2 - 4 * u - bandRoom - arcW - arcGap - ringH0 - ringGap);
  return {
    u,
    S,
    compact,
    fs,
    R,
    ringGap,
    ringH0,
    arcGap,
    arcW,
    labGap,
    bandRoom,
    w1: (compact ? 118 : 140) * u,
    w2: (compact ? 172 : 240) * u,
    pad: (compact ? 8 : 14) * u,
    step: clamp(0.14 * S, 6 * fs, 9 * fs),
  };
};

/** How node radii map to the screen for one layout and canvas. */
export interface Proj {
  G: Geometry;
  unit: number;
  mode: LayoutMode;
  /** Largest distance from the tips to the centre of the layout, px (Infinity: none). */
  dcap: number;
}

export const projFor = (G: Geometry, L: Pick<Layout, "unit" | "mode" | "focus">, kMin = 1): Proj => ({
  G,
  unit: L.unit,
  mode: L.mode,
  dcap: L.mode === "rank" ? Math.max(G.R * kMin, Math.max(1, SPECIES_DEPTH - L.focus.depth) * G.step) : Number.POSITIVE_INFINITY,
});

/** Distance from the tips to the centre of the layout at zoom k, px. */
export const span = (P: Proj, k: number): number => Math.min(P.G.R * k, P.dcap);

/** Screen radius of normalised radius r at zoom k. */
export const radius = (P: Proj, k: number, r: number): number => P.G.R * k - (1 - r) * span(P, k);

/** Normalised radius at screen radius s (negative inside the opened centre). */
export const radiusInv = (P: Proj, k: number, s: number): number => 1 - (P.G.R * k - s) / Math.max(1e-9, span(P, k));

/** Screen radii of the rings outside the tips at zoom k, and how much of the species labels show. */
export interface Zones {
  /** Tip radius. */
  T: number;
  ringIn: number;
  ringOut: number;
  arcIn: number;
  arcOut: number;
  /** Where clade names (outside the arcs) or species names start. */
  labIn: number;
  labOut: number;
  /** Distance between neighbouring species at labIn, px. */
  spacing: number;
  /** 0..1: one-line species labels (abbreviated scientific name). */
  leafA: number;
  /** 0..1: two-line species labels (common name, scientific name and the ring value). */
  twoA: number;
}

export const zones = (G: Geometry, unit: number, k: number): Zones => {
  const T = G.R * k;
  const ringIn = T + G.ringGap;
  const ringH = Math.min(Math.max(G.ringH0, 72 * G.u), G.ringH0 * (1 + 0.15 * Math.log2(Math.max(1, k))));
  const ringOut = ringIn + ringH;
  const arcIn = ringOut + G.arcGap;
  const arcOut = arcIn + G.arcW;
  const labIn = arcOut + G.labGap;
  const spacing = unit * labIn;
  const leafA = smoothstep(0.95 * G.fs, 1.2 * G.fs, spacing);
  // While the whole circle is in view, names go all the way round and must stay short; once the
  // reader has zoomed into part of it they may be as long as they need.
  const capSmall = Math.max(64 * G.u, 0.2 * G.S);
  const cap = capSmall + (G.w2 - capSmall) * smoothstep(0.5 * G.S, 1.2 * G.S, T);
  const twoA = smoothstep(2.4 * G.fs, 2.75 * G.fs, spacing) * smoothstep(0.7 * G.w2, 0.85 * G.w2, cap);
  const band = G.bandRoom - G.labGap;
  const leafW = Math.min(cap, G.w1 + (G.w2 - G.w1) * twoA);
  const labOut = labIn + band + (Math.max(band, leafW) - band) * leafA;
  return { T, ringIn, ringOut, arcIn, arcOut, labIn, labOut, spacing, leafA, twoA };
};

/** Zoom at which neighbouring species are `px` apart at the label radius. */
export const zoomForSpacing = (G: Geometry, unit: number, px: number): number => {
  // spacing = unit * (R k + c), c = the fixed rings between the tips and the labels (taken at k = 1).
  const c = zones(G, unit, 1).labIn - G.R;
  return Math.max(0.05, (px / Math.max(unit, 1e-9) - c) / G.R);
};

/** Largest useful zoom: species about six label heights apart. */
export const maxZoom = (G: Geometry, unit: number): number => Math.max(4, zoomForSpacing(G, unit, 6 * G.fs));

/**
 * A zoom outside the bands where species names fade in (or turn from one line into two), so the
 * view never rests on half-transparent names: the nearer clean zoom, or the one below.
 */
export const snapZoom = (G: Geometry, unit: number, k: number, how: "near" | "down" = "near"): number => {
  const lo = 0.02;
  const hi = 0.98;
  let out = k;
  for (const key of ["leafA", "twoA"] as const) {
    const f = (kk: number) => zones(G, unit, kk)[key];
    const v = f(out);
    if (v <= lo || v >= hi) continue;
    /** k in [a, b] where f crosses `target`, f increasing. */
    const cross = (target: number, a0: number, b0: number): number => {
      let a = a0;
      let b = b0;
      for (let i = 0; i < 40; i++) {
        const m = (a + b) / 2;
        if (f(m) < target) a = m;
        else b = m;
      }
      return target === lo ? a : b;
    };
    const down = cross(lo, out / 2, out);
    const up = cross(hi, out, out * 2);
    out = how === "down" || Math.log(out / down) <= Math.log(up / out) ? down : up;
  }
  return out;
};

/**
 * Zoom of the whole circle: 1, or less when species names already show and need the room (a small
 * clade fills the circle).
 */
export const minZoom = (G: Geometry, unit: number): number => {
  const limit = G.S / 2 - 4 * G.u;
  let a = 1;
  if (zones(G, unit, 1).labOut > limit + 0.5) {
    a = 0.02;
    let b = 1;
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (zones(G, unit, m).labOut <= limit) a = m;
      else b = m;
    }
  }
  return snapZoom(G, unit, a, "down");
};

// ---------------------------------------------------------------- screen <-> polar

export const polar = (cam: Camera, a: number, s: number): [number, number] => {
  const p = a + cam.th;
  return [cam.x + s * Math.sin(p), cam.y - s * Math.cos(p)];
};

/** Layout angle (0..2π) and screen distance from the tree centre of a screen point. */
export const toPolar = (cam: Camera, px: number, py: number): { a: number; s: number } => {
  const dx = px - cam.x;
  const dy = py - cam.y;
  return { a: normAngle(Math.atan2(dx, -dy) - cam.th), s: Math.hypot(dx, dy) };
};

export const home = (vp: Viewport, kMin = 1): Camera => ({ k: kMin, x: vp.w / 2, y: vp.h / 2, th: 0 });

/** World point (k = 1 px, unrotated, tree centre at 0) shown at the middle of the viewport. */
export const viewCentre = (cam: Camera, vp: Viewport): [number, number] => {
  const dx = (vp.w / 2 - cam.x) / cam.k;
  const dy = (vp.h / 2 - cam.y) / cam.k;
  const c = Math.cos(-cam.th);
  const s = Math.sin(-cam.th);
  return [dx * c - dy * s, dx * s + dy * c];
};

/** Camera with zoom k and rotation th that shows world point p at the middle of the viewport. */
export const cameraAt = (p: [number, number], k: number, th: number, vp: Viewport): Camera => {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const rx = p[0] * c - p[1] * s;
  const ry = p[0] * s + p[1] * c;
  return { k, x: vp.w / 2 - k * rx, y: vp.h / 2 - k * ry, th };
};

/**
 * Keep the tree on screen: while the whole drawing fits in a direction it stays centred, otherwise
 * the viewport may not leave the drawing's bounding box (plus a little slack).
 */
export const constrain = (G: Geometry, unit: number, vp: Viewport, cam: Camera): Camera => {
  const out = zones(G, unit, cam.k).labOut;
  const rad = out + G.pad;
  const slack = Math.max(40 * G.u, 0.12 * Math.min(vp.w, vp.h));
  const axis = (pos: number, size: number): number => {
    if (2 * out <= size + 0.5) return size / 2;
    return clamp(pos, size - rad - slack, rad + slack);
  };
  return { k: cam.k, x: axis(cam.x, vp.w), y: axis(cam.y, vp.h), th: cam.th };
};

/**
 * Camera at zoom k2 that keeps the part of the drawing under screen point `from` (in `cam`) under
 * screen point `to`: zooming about the pointer. Points outside the tips keep their distance from
 * the tips; points inside keep their normalised radius.
 */
export const zoomAbout = (P: Proj, cam: Camera, k2: number, from: [number, number], to: [number, number]): Camera => {
  const { a, s } = toPolar(cam, from[0], from[1]);
  const T = P.G.R * cam.k;
  const T2 = P.G.R * k2;
  const s2 = s >= T ? T2 + (s - T) : radius(P, k2, radiusInv(P, cam.k, s));
  const p = a + cam.th;
  return { k: k2, x: to[0] - s2 * Math.sin(p), y: to[1] + s2 * Math.cos(p), th: cam.th };
};

// ---------------------------------------------------------------- fitting

export interface FitContext {
  model: TreeModel;
  L: Layout;
  G: Geometry;
  vp: Viewport;
  kMin: number;
  kMax: number;
}

/** Angular extent of a node's leaf slots in the layout. */
export const nodeSpan = (model: TreeModel, pose: Pick<Pose, "la" | "lw">, n: TNode): [number, number] => {
  const i = n.data.i;
  const l0 = model.leafRange[2 * i] ?? 0;
  const l1 = model.leafRange[2 * i + 1] ?? 0;
  return [(pose.la[l0] ?? 0) - (pose.lw[l0] ?? 0), (pose.la[l1] ?? 0) + (pose.lw[l1] ?? 0)];
};

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Screen bounding box, relative to the tree centre, of an annular sector. */
const sectorBox = (p0: number, p1: number, sIn: number, sOut: number): Box => {
  const b: Box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  const add = (p: number, s: number) => {
    const x = s * Math.sin(p);
    const y = -s * Math.cos(p);
    if (x < b.x0) b.x0 = x;
    if (x > b.x1) b.x1 = x;
    if (y < b.y0) b.y0 = y;
    if (y > b.y1) b.y1 = y;
  };
  add(p0, sIn);
  add(p0, sOut);
  add(p1, sIn);
  add(p1, sOut);
  for (let q = Math.ceil(p0 / (Math.PI / 2)) * (Math.PI / 2); q < p1; q += Math.PI / 2) {
    add(q, sOut);
    add(q, sIn);
  }
  return b;
};

/** Rotation that turns angle `mid` to 3 or 9 o'clock, whichever is closer; 0 for wide sectors. */
export const readableTurn = (mid: number, span: number): number => {
  if (span > Math.PI) return 0;
  const right = angleDiff(mid, Math.PI / 2);
  const left = angleDiff(mid, (3 * Math.PI) / 2);
  return Math.abs(right) <= Math.abs(left) ? right : left;
};

export interface SectorFit {
  /** Layout angles of the sector. */
  a0: number;
  a1: number;
  /** Normalised inner radius (the outer edge is always the species labels). */
  rIn: number;
  /**
   * Preferred distances between species labels, tried in order; the inner part of the tree may be
   * cut off to reach one, as long as the species themselves fit.
   */
  spacings?: number[];
  /** Upper bound on the distance between species. */
  maxSpacing?: number;
}

/** Camera that shows a sector of the tree as large as possible, turned so its labels read across. */
export const fitSector = (ctx: FitContext, f: SectorFit): Camera => {
  const { G, vp, L } = ctx;
  const P = projFor(G, L, ctx.kMin);
  const th = readableTurn((f.a0 + f.a1) / 2, f.a1 - f.a0);
  const p0 = f.a0 + th;
  const p1 = f.a1 + th;
  const W = vp.w - 2 * G.pad;
  const H = vp.h - 2 * G.pad;
  const box = (k: number, rIn: number): Box => sectorBox(p0, p1, Math.max(0, radius(P, k, rIn)), zones(G, L.unit, k).labOut);
  const fits = (k: number, rIn: number): boolean => {
    const b = box(k, rIn);
    return b.x1 - b.x0 <= W && b.y1 - b.y0 <= H;
  };
  /** Largest k in [lo, hi] for which ok(k) holds, assuming ok(lo). */
  const largest = (lo: number, hi: number, ok: (k: number) => boolean): number => {
    if (ok(hi)) return hi;
    let a = lo;
    let b = hi;
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (ok(m)) a = m;
      else b = m;
    }
    return a;
  };
  const kMin = ctx.kMin;
  const kMax = Math.max(kMin, ctx.kMax);
  let rIn = clamp(f.rIn, 0, 1);
  let k = fits(kMin, rIn) ? largest(kMin, kMax, (kk) => fits(kk, rIn)) : kMin;

  // Not readable yet: cut off the inner part of the tree, keeping at least a stub of the branches.
  const keep = (kk: number) => Math.min(1, 1 - (56 * G.u) / span(P, kk));
  for (const sp of f.spacings ?? []) {
    if (zones(G, L.unit, k).spacing >= sp) break;
    const kT = Math.min(kMax, zoomForSpacing(G, L.unit, sp));
    if (kT <= k || !fits(kT, Math.max(rIn, keep(kT)))) continue;
    // Smallest inner radius (most of the tree) that still fits at kT.
    let a = Math.max(rIn, 0);
    let b = Math.max(rIn, keep(kT));
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (fits(kT, m)) b = m;
      else a = m;
    }
    k = kT;
    rIn = b;
    break;
  }
  if (f.maxSpacing !== undefined) {
    const kS = zoomForSpacing(G, L.unit, f.maxSpacing);
    if (k > kS) k = Math.max(kMin, kS);
  }
  k = Math.max(kMin, snapZoom(G, L.unit, k, "down"));
  const b = box(k, rIn);
  const cam: Camera = { k, x: vp.w / 2 - (b.x0 + b.x1) / 2, y: vp.h / 2 - (b.y0 + b.y1) / 2, th };
  return constrain(G, L.unit, vp, cam);
};

/** Normalised radius a fitted clade starts at: the node and most of its stem, where its name is. */
const innerRadius = (L: Layout, n: TNode): number => {
  const rn = L.r[n.data.i] ?? 0;
  const rp = n.parent ? (L.r[n.parent.data.i] ?? 0) : rn;
  return Math.max(0, rn - 0.85 * Math.max(0, rn - rp));
};

/** Label spacings worth zooming for, when `count` species fit across the viewport. */
const readableSpacings = (ctx: FitContext, count: number): number[] => {
  const { G, vp } = ctx;
  const across = Math.max(vp.h, vp.w) - 2 * G.pad;
  return [2.8 * G.fs, 1.3 * G.fs].filter((sp) => count * sp <= across * 0.92);
};

export const fitClade = (ctx: FitContext, n: TNode): Camera => {
  const { model, L, vp, G } = ctx;
  if (n === L.focus) return home(vp, ctx.kMin);
  if (!n.children) return fitLeaf(ctx, n);
  const [a0, a1] = nodeSpan(model, L, n);
  return fitSector(ctx, {
    a0,
    a1,
    rIn: innerRadius(L, n),
    spacings: readableSpacings(ctx, n.value ?? 1),
    maxSpacing: 3.6 * G.fs,
  });
};

/** Show a species with its neighbours, its name readable, centred. */
export const fitLeaf = (ctx: FitContext, leaf: TNode): Camera => {
  const { L, G } = ctx;
  const k = leaf.data.leafIndex;
  const a = L.la[k] ?? 0;
  const w = Math.max(L.unit, 1e-6);
  const group = leaf.parent?.parent ?? leaf.parent ?? leaf;
  return fitSector(ctx, {
    a0: a - 3.5 * w,
    a1: a + 3.5 * w,
    rIn: innerRadius(L, group),
    spacings: [2.8 * G.fs, 1.3 * G.fs],
    maxSpacing: 3.2 * G.fs,
  });
};

// ---------------------------------------------------------------- what is where

/** Leaf whose ring slot contains layout angle `a`, inside the layout's focus. */
export const leafAt = (model: TreeModel, pose: Pick<Pose, "la" | "lw">, focus: TNode, a: number, tolerance = 0): TNode | null => {
  const fi = focus.data.i;
  const first = model.leafRange[2 * fi] ?? 0;
  const last = model.leafRange[2 * fi + 1] ?? 0;
  let lo = first;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((pose.la[mid] ?? 0) < a) lo = mid + 1;
    else hi = mid;
  }
  let best = lo;
  if (lo > first && Math.abs((pose.la[lo - 1] ?? 0) - a) < Math.abs((pose.la[lo] ?? 0) - a)) best = lo - 1;
  const half = Math.max(pose.lw[best] ?? 0, 1e-6);
  return Math.abs((pose.la[best] ?? 0) - a) <= half + tolerance ? (model.leaves[best] ?? null) : null;
};

/**
 * Deepest clade whose wedge holds the point: the angle lies within its leaf slots and the radius
 * (normalised, 0 = centre, 1 = tips) is at or beyond its node. Starts from the layout's focus.
 */
export const cladeAt = (model: TreeModel, pose: Pick<Pose, "r" | "la" | "lw">, focus: TNode, a: number, rho: number): TNode => {
  let n = focus;
  for (;;) {
    const kids: TNode[] = n.children ?? [];
    let next: TNode | null = null;
    for (const c of kids) {
      const [c0, c1] = nodeSpan(model, pose, c);
      if (a >= c0 && a <= c1) {
        next = c;
        break;
      }
    }
    if (!next || !next.children || (pose.r[next.data.i] ?? 0) > rho) return n;
    n = next;
  }
};

/**
 * The clade the reader is looking at: the deepest clade holding at least `share` of the species
 * whose ring slots are in the middle of the screen (or anywhere on it, or of the visible nodes, when
 * none are). The whole-circle view is the layout's focus. The `current` clade is kept while it
 * still holds half of them and nothing deeper qualifies, so a small zoom does not jump upwards.
 */
export const viewClade = (
  model: TreeModel,
  L: Layout,
  G: Geometry,
  cam: Camera,
  vp: Viewport,
  kMin = 1,
  current: TNode | null = null,
  share = 0.85,
): TNode => {
  if (cam.k <= kMin * 1.02) return L.focus;
  const z = zones(G, L.unit, cam.k);
  const P = projFor(G, L, kMin);
  const s = (z.ringIn + z.ringOut) / 2;
  const fi = L.focus.data.i;
  const l0 = model.leafRange[2 * fi] ?? 0;
  const l1 = model.leafRange[2 * fi + 1] ?? 0;
  const tally = (inset: number): { counts: Map<TNode, number>; total: number } => {
    const mx = vp.w * inset;
    const my = vp.h * inset;
    const inside = (x: number, y: number) => x >= mx && x <= vp.w - mx && y >= my && y <= vp.h - my;
    const counts = new Map<TNode, number>();
    let total = 0;
    const bump = (from: TNode | null) => {
      total++;
      for (let p = from; p; p = p === L.focus ? null : p.parent) counts.set(p, (counts.get(p) ?? 0) + 1);
    };
    for (let k = l0; k <= l1; k++) {
      const [x, y] = polar(cam, L.la[k] ?? 0, s);
      if (inside(x, y)) bump(model.leaves[k]?.parent ?? null);
    }
    if (!total) {
      L.focus.each((n) => {
        if (!n.children) return;
        const [x, y] = polar(cam, L.a[n.data.i] ?? 0, radius(P, cam.k, L.r[n.data.i] ?? 0));
        if (inside(x, y)) bump(n);
      });
    }
    return { counts, total };
  };
  let t = tally(0.22);
  if (!t.total) t = tally(0);
  if (!t.total) return L.focus;
  let best = L.focus;
  for (const [n, c] of t.counts) if (c >= share * t.total && n.depth > best.depth) best = n;
  if (current && current.children && best.depth <= current.depth && (t.counts.get(current) ?? 0) >= 0.5 * t.total) return current;
  return best;
};

// ---------------------------------------------------------------- clipping

/**
 * Part [s0, s1] of the ray from the tree centre at screen angle p, between radii sA and sB, that
 * lies inside the viewport shrunk by `m`; null when none does.
 */
export const clipRay = (cam: Camera, vp: Viewport, p: number, sA: number, sB: number, m: number): [number, number] | null => {
  const dx = Math.sin(p);
  const dy = -Math.cos(p);
  let lo = sA;
  let hi = sB;
  const edge = (c: number, d: number, min: number, max: number): boolean => {
    if (Math.abs(d) < 1e-12) return c >= min && c <= max;
    let t0 = (min - c) / d;
    let t1 = (max - c) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0);
    hi = Math.min(hi, t1);
    return lo <= hi;
  };
  if (!edge(cam.x, dx, m, vp.w - m) || !edge(cam.y, dy, m, vp.h - m)) return null;
  return lo <= hi ? [lo, hi] : null;
};

/**
 * Longest run of screen angles in [p0, p1] where the circle of radius s around the tree centre is
 * inside the viewport shrunk by `m`; null when none is.
 */
export const visibleArc = (cam: Camera, vp: Viewport, s: number, p0: number, p1: number, m: number): [number, number] | null => {
  if (p1 <= p0 || s <= 0) return null;
  const n = Math.round(clamp(((p1 - p0) * s) / 6, 24, 1500));
  let best: [number, number] | null = null;
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const p = p0 + ((p1 - p0) * i) / n;
    const x = cam.x + s * Math.sin(p);
    const y = cam.y - s * Math.cos(p);
    const ok = x >= m && x <= vp.w - m && y >= m && y <= vp.h - m;
    if (ok && start < 0) start = i;
    if ((!ok || i === n) && start >= 0) {
      const end = ok ? i : i - 1;
      const run: [number, number] = [p0 + ((p1 - p0) * start) / n, p0 + ((p1 - p0) * end) / n];
      if (!best || run[1] - run[0] > best[1] - best[0]) best = run;
      start = -1;
    }
  }
  return best;
};

/** Smallest and largest distance from the tree centre to the viewport. */
export const radialRange = (cam: Camera, vp: Viewport): [number, number] => {
  const nx = clamp(cam.x, 0, vp.w);
  const ny = clamp(cam.y, 0, vp.h);
  const near = Math.hypot(nx - cam.x, ny - cam.y);
  let far = 0;
  for (const [x, y] of [
    [0, 0],
    [vp.w, 0],
    [0, vp.h],
    [vp.w, vp.h],
  ] as const) {
    far = Math.max(far, Math.hypot(x - cam.x, y - cam.y));
  }
  return [near, far];
};

/** Round tick values between lo and hi, about n of them. */
export const niceTicks = (lo: number, hi: number, n: number): number[] => {
  if (!(hi > lo)) return [];
  const raw = (hi - lo) / Math.max(1, n);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((st) => (hi - lo) / st <= n + 1) ?? pow * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
};
