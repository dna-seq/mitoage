/**
 * Radial layout of a (sub)tree rooted on one clade, and interpolation between two layouts
 * (the animated switch between the rank and time layouts). camera.ts puts a layout on screen.
 * Pure functions over the decoded model; safe for islands.
 *
 * Angles are radians clockwise from 12 o'clock. Radii are normalised: 0 is the focus at the
 * centre, 1 is the tips. Every node of the whole tree gets a position in every layout, so a
 * transition can move nodes that leave or enter the view (they squeeze into the seam at the
 * top, or collapse into the centre) while fading them.
 */
import { CLASS_DEPTH, SPECIES_DEPTH, type TNode, type TreeModel } from "./types";

export type LayoutMode = "rank" | "time";

/*
 * Pose arrays: by node index a (angle), r (radius), vis (0/1); by leaf index la (centre angle of
 * the ring slot) and lw (its half-width, 0 outside the focus).
 */
export interface LayoutOptions {
  mode: LayoutMode;
  /** Absolute depth of the terminals; deeper nodes are collapsed into their ancestor at this depth. */
  displayDepth: number;
  /** Absolute depth of the outer arcs (bands); 0 for none. */
  bandDepth: number;
  /** Opening at 12 o'clock for the axis labels, radians. */
  gap: number;
}

export interface Band {
  node: TNode;
  a0: number;
  a1: number;
}

export interface Layout extends Pose {
  focus: TNode;
  mode: LayoutMode;
  displayDepth: number;
  bandDepth: number;
  /** Visible nodes in pre-order (focus first). */
  visible: TNode[];
  /** Visible nodes without visible children: leaves, or collapsed clades. */
  terminals: TNode[];
  bands: Band[];
  /** Age of the focus (time mode), Mya. */
  focusAge: number;
  start: number;
  end: number;
  /** Angle per leaf slot. */
  unit: number;
  leafCount: number;
}

export const isAncestorOf = (a: TNode, b: TNode): boolean => {
  let p: TNode | null = b;
  while (p) {
    if (p === a) return true;
    p = p.parent;
  }
  return false;
};

/** Default depth of the outer arcs: classes at the top of the tree, else one rank below the focus. */
export const defaultBandDepth = (focus: TNode): number =>
  Math.min(SPECIES_DEPTH, Math.max(CLASS_DEPTH, focus.depth + 1));

const ancestorAt = (n: TNode, depth: number): TNode => {
  let p: TNode = n;
  while (p.depth > depth && p.parent) p = p.parent;
  return p;
};

export const nodeAge = (n: TNode): number => n.data.age ?? 0;

/** True when the time layout can be drawn for this focus. */
export const canTime = (model: TreeModel, focus: TNode): boolean =>
  model.rootAge !== null && nodeAge(focus) > 0;

export const computeLayout = (model: TreeModel, focus: TNode, opts: LayoutOptions): Layout => {
  const N = model.nodes.length;
  const L = model.leaves.length;
  const a = new Float64Array(N);
  const r = new Float64Array(N);
  const vis = new Float64Array(N);
  const la = new Float64Array(L);
  const lw = new Float64Array(L);
  const mode: LayoutMode = opts.mode === "time" && canTime(model, focus) ? "time" : "rank";
  const displayDepth = Math.max(focus.depth + 1, Math.min(SPECIES_DEPTH, opts.displayDepth));
  const bandDepth = opts.bandDepth > focus.depth ? Math.min(SPECIES_DEPTH, opts.bandDepth) : 0;
  const fi = focus.data.i;
  const l0 = model.leafRange[2 * fi] ?? 0;
  const l1 = model.leafRange[2 * fi + 1] ?? 0;
  const n = l1 - l0 + 1;
  const start = opts.gap / 2;
  const end = Math.PI * 2 - opts.gap / 2;

  // ---- leaf slots, with a little extra space between bands
  let bandCount = 0;
  if (bandDepth) {
    let prev: TNode | null = null;
    for (let k = l0; k <= l1; k++) {
      const b = ancestorAt(model.leaves[k] as TNode, bandDepth);
      if (b !== prev) bandCount++;
      prev = b;
    }
  }
  const bandGap = bandCount > 1 ? Math.min(3, Math.max(0.5, (0.06 * n) / (bandCount - 1))) : 0;
  const totalUnits = n + bandGap * Math.max(0, bandCount - 1);
  const unit = (end - start) / Math.max(1, totalUnits);
  {
    let prev: TNode | null = null;
    let u = 0;
    for (let k = l0; k <= l1; k++) {
      if (bandDepth) {
        const b = ancestorAt(model.leaves[k] as TNode, bandDepth);
        if (prev && b !== prev) u += bandGap;
        prev = b;
      }
      la[k] = start + (u + 0.5) * unit;
      lw[k] = unit / 2;
      u += 1;
    }
  }
  // Leaves outside the focus squeeze into the seam.
  for (let k = 0; k < L; k++) {
    if (k < l0) {
      la[k] = start;
      lw[k] = 0;
    } else if (k > l1) {
      la[k] = end;
      lw[k] = 0;
    }
  }

  // ---- angles of every node: leaves from slots, parents at the middle of first and last child
  model.root.eachAfter((d) => {
    const i = d.data.i;
    if (!d.children) a[i] = la[d.data.leafIndex] ?? 0;
    else {
      const first = d.children[0] as TNode;
      const last = d.children[d.children.length - 1] as TNode;
      a[i] = ((a[first.data.i] ?? 0) + (a[last.data.i] ?? 0)) / 2;
    }
  });

  // ---- radii
  const focusAge = nodeAge(focus);
  const denom = (displayDepth >= SPECIES_DEPTH ? SPECIES_DEPTH : displayDepth + 1) - focus.depth;
  const radiusOf = (d: TNode): number => {
    if (mode === "time") return Math.min(1, Math.max(0, 1 - nodeAge(d) / focusAge));
    return Math.min(1, Math.max(0, (d.depth - focus.depth) / denom));
  };
  const visible: TNode[] = [];
  const terminals: TNode[] = [];
  model.root.eachBefore((d) => {
    const i = d.data.i;
    const dl0 = model.leafRange[2 * i] ?? 0;
    const dl1 = model.leafRange[2 * i + 1] ?? 0;
    if (dl1 < l0) {
      a[i] = start;
      r[i] = radiusOf(d);
      return;
    }
    if (dl0 > l1) {
      a[i] = end;
      r[i] = radiusOf(d);
      return;
    }
    if (d.depth < focus.depth) {
      // Ancestor of the focus: collapses into the centre.
      a[i] = (start + end) / 2;
      r[i] = 0;
      return;
    }
    if (d.depth <= displayDepth) {
      r[i] = radiusOf(d);
      vis[i] = 1;
      visible.push(d);
      if (d.depth === displayDepth || !d.children) terminals.push(d);
    } else {
      // Hidden inside a collapsed terminal: keep its angle, sit at the terminal's radius.
      r[i] = r[ancestorAt(d, displayDepth).data.i] ?? 0;
    }
  });
  r[fi] = 0;

  // ---- bands
  const bands: Band[] = [];
  if (bandDepth) {
    focus.eachBefore((d) => {
      if (d.depth !== bandDepth) return;
      const i = d.data.i;
      const b0 = model.leafRange[2 * i] ?? 0;
      const b1 = model.leafRange[2 * i + 1] ?? 0;
      bands.push({ node: d, a0: (la[b0] ?? 0) - unit / 2, a1: (la[b1] ?? 0) + unit / 2 });
    });
  }

  return {
    focus,
    mode,
    displayDepth,
    bandDepth,
    a,
    r,
    vis,
    la,
    lw,
    visible,
    terminals,
    bands,
    focusAge,
    start,
    end,
    unit,
    leafCount: n,
  };
};

/** Positions of every node and leaf slot; a Layout, or a frame caught mid-transition. */
export interface Pose {
  a: Float64Array;
  r: Float64Array;
  /** Visibility or opacity, 0..1. */
  vis: Float64Array;
  la: Float64Array;
  lw: Float64Array;
}

export interface Frame {
  a: Float64Array;
  r: Float64Array;
  /** Opacity 0..1. */
  op: Float64Array;
  la: Float64Array;
  lw: Float64Array;
  /** Node indices to draw (visible in either layout), pre-order. */
  draw: number[];
}

const lerp = (x: number, y: number, t: number): number => x + (y - x) * t;

export const frameToPose = (f: Frame): Pose => ({ a: f.a, r: f.r, vis: f.op, la: f.la, lw: f.lw });

/** Interpolated positions between a pose and a layout at eased progress `t` (0 = from, 1 = to). */
export const interpolate = (model: TreeModel, from: Pose | null, to: Layout, t: number): Frame => {
  const N = model.nodes.length;
  const L = model.leaves.length;
  if (!from || t >= 1) {
    const draw: number[] = to.visible.map((d) => d.data.i);
    return { a: to.a, r: to.r, op: to.vis, la: to.la, lw: to.lw, draw };
  }
  const a = new Float64Array(N);
  const r = new Float64Array(N);
  const op = new Float64Array(N);
  const la = new Float64Array(L);
  const lw = new Float64Array(L);
  const draw: number[] = [];
  for (let i = 0; i < N; i++) {
    const v0 = from.vis[i] ?? 0;
    const v1 = to.vis[i] ?? 0;
    a[i] = lerp(from.a[i] ?? 0, to.a[i] ?? 0, t);
    r[i] = lerp(from.r[i] ?? 0, to.r[i] ?? 0, t);
    op[i] = lerp(v0, v1, t);
    if (v0 > 0.001 || v1 > 0) draw.push(i);
  }
  for (let k = 0; k < L; k++) {
    la[k] = lerp(from.la[k] ?? 0, to.la[k] ?? 0, t);
    lw[k] = lerp(from.lw[k] ?? 0, to.lw[k] ?? 0, t);
  }
  return { a, r, op, la, lw, draw };
};

/** Nice tick values (Mya) for the time rings of a focus of age `age`. */
export const ageTicks = (age: number): number[] => {
  if (!(age > 0)) return [];
  const target = 6;
  const raw = age / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => age / s <= target + 1) ?? pow * 10;
  const out: number[] = [];
  for (let v = step; v < age * 0.999; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
};
