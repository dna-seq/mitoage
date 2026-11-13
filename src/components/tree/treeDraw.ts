/**
 * Canvas drawing for the zoomable radial tree (RadialTree.tsx): rank or time rings, the value
 * ring, branches coloured by class, clade arcs, clade names on their stems and species names at
 * deep zoom. Colours come from the theme tokens, resolved once per theme and metric. Browser only.
 */
import { classColor, classLabel } from "~/lib/classes";
import { fmtNum } from "~/lib/format";
import {
  clamp,
  nodeSpan,
  niceTicks,
  polar,
  radialRange,
  smoothstep,
  visibleArc,
  zones,
  type Camera,
  type Geometry,
  type Viewport,
  type Zones,
} from "~/lib/tree/camera";
import { boxesOverlap, placeStemLabels, radialRotation, type PlacedLabel } from "~/lib/tree/labels";
import { ageTicks, type Layout, type Pose } from "~/lib/tree/layout";
import { abbrevName, rankPlural } from "~/lib/tree/names";
import { parseRgb, RAMP_MID, rampColors, type Metric, type RingTick, type Rgb } from "~/lib/tree/ring";
import { CLASS_DEPTH, RANKS, SPECIES_DEPTH, type TNode, type TreeModel } from "~/lib/tree/types";

// ---------------------------------------------------------------- palette

export interface Palette {
  bg: string;
  sunken: string;
  grid: string;
  tick: string;
  heading: string;
  muted: string;
  axis: string;
  highlight: string;
  highlightHalo: string;
  /** Colour of the ring value in species labels. */
  ink: string;
  neutral: string;
  classes: Map<string, string>;
  ramp: string[];
  family: string;
}

const METRIC_INK: Record<Metric, string> = {
  life: "var(--tone-red-ink)",
  gc: "var(--tone-sky-ink)",
  size: "var(--tone-green-ink)",
};

/** Resolve the theme tokens the canvas needs, inside `root` (the .rtree element). */
export const readPalette = (root: HTMLElement, model: TreeModel | null, metric: Metric): Palette => {
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
  root.appendChild(probe);
  const res = (v: string): string => {
    probe.style.color = "";
    probe.style.color = v;
    return getComputedStyle(probe).color;
  };
  const rgb = (v: string): Rgb => parseRgb(res(v)) ?? [128, 128, 128];
  const classes = new Map<string, string>();
  if (model) {
    for (const n of model.nodes) {
      const c = n.data.cls;
      if (c && !classes.has(c)) classes.set(c, res(classColor(c)));
    }
  }
  const pal: Palette = {
    bg: res("var(--rt-bg)"),
    sunken: res("var(--color-surface-sunken)"),
    grid: res("var(--chart-grid)"),
    tick: res("var(--chart-tick)"),
    heading: res("var(--color-heading)"),
    muted: res("var(--color-text-muted)"),
    axis: res("var(--chart-axis)"),
    highlight: res("var(--chart-highlight)"),
    highlightHalo: res("var(--chart-highlight-halo)"),
    ink: res(METRIC_INK[metric]),
    neutral: res("var(--rt-neutral)"),
    classes,
    ramp: rampColors(rgb("var(--ring-lo)"), rgb("var(--ring-mid)"), rgb("var(--ring-hi)"), RAMP_MID[metric]),
    family: getComputedStyle(root).fontFamily || "sans-serif",
  };
  probe.remove();
  return pal;
};

export const nodeColor = (pal: Palette, n: TNode): string =>
  n.depth >= CLASS_DEPTH && n.data.cls ? (pal.classes.get(n.data.cls) ?? pal.neutral) : pal.neutral;

// ---------------------------------------------------------------- text

export interface Measurer {
  font: (weight: number, size: number, italic?: boolean) => string;
  width: (font: string, text: string) => number;
  /** Text cut with an ellipsis to fit `max` px. */
  fit: (font: string, text: string, max: number) => string;
  clear: () => void;
}

export const createMeasurer = (ctx: CanvasRenderingContext2D, family: () => string): Measurer => {
  const cache = new Map<string, number>();
  const width = (font: string, text: string): number => {
    const key = `${font}|${text}`;
    let w = cache.get(key);
    if (w === undefined) {
      ctx.font = font;
      w = ctx.measureText(text).width;
      if (cache.size > 20000) cache.clear();
      cache.set(key, w);
    }
    return w;
  };
  return {
    font: (weight, size, italic = false) => `${italic ? "italic " : ""}${weight} ${size.toFixed(2)}px ${family()}`,
    width,
    fit: (font, text, max) => {
      if (width(font, text) <= max) return text;
      let lo = 0;
      let hi = text.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (width(font, `${text.slice(0, mid).trimEnd()}…`) <= max) lo = mid;
        else hi = mid - 1;
      }
      return lo > 0 ? `${text.slice(0, lo).trimEnd()}…` : "";
    },
    clear: () => cache.clear(),
  };
};

// ---------------------------------------------------------------- scene

export type Zone = "tree" | "wedge" | "ring" | "band";

export interface Scene {
  model: TreeModel;
  /** Target layout: focus, slots, bands, mode. */
  L: Layout;
  /** Positions to draw (L itself, or a frame of a transition between layouts). */
  pose: Pose;
  /** True when pose is L (names are drawn only then). */
  rest: boolean;
  G: Geometry;
  cam: Camera;
  vp: Viewport;
  dpr: number;
  /** Distance from the tips to the centre of the layout, px (see camera.ts). */
  D: number;
  /** Zoom of the whole-circle view. */
  kMin: number;
  /** Ring values 0..1 by leaf; NaN when missing. */
  vals: Float64Array;
  ticks: RingTick[];
  valueText: (leaf: TNode) => string;
  hover: { node: TNode; zone: Zone } | null;
  selected: TNode | null;
}

export interface DrawResult {
  stems: PlacedLabel[];
  z: Zones;
}

const TAU = Math.PI * 2;

/** Label candidates for a clade arc, longest first. */
const bandTexts = (n: TNode): string[] => {
  if (!n.children) return [abbrevName(n.data.name)];
  if (n.data.rank === "class") {
    const friendly = classLabel(n.data.name);
    return friendly !== n.data.name ? [friendly, n.data.name] : [n.data.name];
  }
  return [n.data.name];
};

export const drawScene = (ctx: CanvasRenderingContext2D, sc: Scene, pal: Palette, M: Measurer): DrawResult => {
  const { model, L, pose, G, cam, vp } = sc;
  const u = G.u;
  const fs = G.fs;
  ctx.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0);
  ctx.clearRect(0, 0, vp.w, vp.h);
  const z = zones(G, L.unit, cam.k);
  const T = z.T;
  const D = Math.max(1e-6, sc.D);
  /** Screen radius of a normalised radius. */
  const rad = (r: number): number => T - (1 - r) * D;
  const { x: cx, y: cy, th } = cam;
  /** Canvas arc angle of a layout angle. */
  const A = (a: number): number => a + th - Math.PI / 2;
  const fi = L.focus.data.i;
  const l0 = model.leafRange[2 * fi] ?? 0;
  const l1 = model.leafRange[2 * fi + 1] ?? 0;
  const leafCount = l1 - l0 + 1;
  const slotPx = L.unit * z.ringIn;
  const at = (arr: Float64Array, i: number): number => arr[i] ?? 0;
  const pos = (i: number): [number, number] => polar(cam, at(pose.a, i), Math.max(0, rad(at(pose.r, i))));
  const active = sc.hover?.node ?? sc.selected;
  const dim = !!active && (active === L.focus || isInside(L.focus, active));
  const inView = (x: number, y: number, m: number) => x >= -m && x <= vp.w + m && y >= -m && y <= vp.h + m;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ---- guides: one ring per rank, or round ages in the time layout
  const guides: { s: number; label: string }[] = [];
  if (L.mode === "time" && L.focusAge > 0) {
    const [near, far] = radialRange(cam, vp);
    const r0 = clamp(1 - (T - near) / D, 0, 1);
    const r1 = clamp(1 - (T - far) / D, 0, 1);
    const ageHi = (1 - r0) * L.focusAge;
    const ageLo = (1 - r1) * L.focusAge;
    const ticks = cam.k <= 1.05 ? ageTicks(L.focusAge) : niceTicks(ageLo, ageHi, 5);
    for (const age of ticks) {
      if (age <= 0 || age >= L.focusAge) continue;
      guides.push({ s: rad(1 - age / L.focusAge), label: `${fmtNum(age, age < 10 ? 1 : 0)} Mya` });
    }
  } else {
    const fd = L.focus.depth;
    const denom = SPECIES_DEPTH - fd;
    for (let d = fd + 1; d < SPECIES_DEPTH; d++) {
      const rank = RANKS[d];
      if (rank) guides.push({ s: rad((d - fd) / denom), label: rankPlural(rank) });
    }
  }
  ctx.save();
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1.2 * u;
  ctx.setLineDash([2 * u, 5 * u]);
  for (const g of guides) {
    if (g.s < 4 * u) continue;
    ctx.beginPath();
    ctx.arc(cx, cy, g.s, A(L.start), A(L.end));
    ctx.stroke();
  }
  ctx.restore();

  // ---- ring track and grid
  const ringH = z.ringOut - z.ringIn;
  ctx.fillStyle = pal.sunken;
  ctx.beginPath();
  ctx.arc(cx, cy, z.ringOut, A(L.start - 0.004), A(L.end + 0.004));
  ctx.arc(cx, cy, z.ringIn, A(L.end + 0.004), A(L.start - 0.004), true);
  ctx.closePath();
  ctx.fill();
  const gridA = smoothstep(5 * u, 12 * u, slotPx);
  if (gridA > 0.01) {
    ctx.save();
    ctx.globalAlpha = gridA;
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1 * u;
    for (const tk of sc.ticks) {
      ctx.beginPath();
      ctx.arc(cx, cy, z.ringIn + ringH * (0.1 + 0.9 * tk.t), A(L.start), A(L.end));
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- value bars
  {
    const gapK = slotPx > 3 * u ? 0.78 : 1;
    const maxHalf = Math.max(0.6 * u, Math.min(slotPx * 0.42, 10 * u)) / Math.max(1, z.ringIn);
    const buckets = new Map<number, Path2D>();
    for (let k = l0; k <= l1; k++) {
      const w = Math.min(at(pose.lw, k) * gapK, maxHalf);
      if (w < 1e-7) continue;
      const v = sc.vals[k] ?? Number.NaN;
      const vv = Number.isFinite(v) ? v : 0;
      const a = at(pose.la, k);
      const s1 = z.ringIn + ringH * (0.1 + 0.9 * vv);
      const ci = Math.round(clamp(vv, 0, 1) * (pal.ramp.length - 1));
      let p = buckets.get(ci);
      if (!p) buckets.set(ci, (p = new Path2D()));
      p.moveTo(...polar(cam, a - w, z.ringIn));
      p.arc(cx, cy, s1, A(a - w), A(a + w));
      p.arc(cx, cy, z.ringIn, A(a + w), A(a - w), true);
      p.closePath();
    }
    for (const [ci, p] of buckets) {
      ctx.fillStyle = pal.ramp[ci] ?? pal.neutral;
      ctx.fill(p);
    }
  }

  // ---- branches
  const base = leafCount > 500 ? 0.85 : leafCount > 200 ? 1.1 : leafCount > 60 ? 1.5 : 2;
  const linkW = Math.min(2.6, base * (1 + 0.28 * Math.log2(Math.max(1, cam.k)))) * u;
  const linkPath = (p: Path2D, n: TNode) => {
    const par = n.parent as TNode;
    const i = n.data.i;
    const pi = par.data.i;
    const ac = at(pose.a, i);
    const ap = at(pose.a, pi);
    const sc0 = Math.max(0, rad(at(pose.r, i)));
    const sp = Math.max(0, rad(at(pose.r, pi)));
    p.moveTo(...polar(cam, ac, sc0));
    p.lineTo(...polar(cam, ac, sp));
    if (sp > 0.5 && Math.abs(ap - ac) > 1e-6) p.arc(cx, cy, sp, A(ac), A(ap), ap < ac);
  };
  {
    const groups = new Map<string, Path2D>();
    L.focus.each((n) => {
      if (n === L.focus || !n.parent) return;
      const color = nodeColor(pal, n);
      let p = groups.get(color);
      if (!p) groups.set(color, (p = new Path2D()));
      linkPath(p, n);
    });
    ctx.save();
    ctx.globalAlpha = dim ? 0.3 : 1;
    ctx.lineWidth = linkW;
    for (const [color, p] of groups) {
      ctx.strokeStyle = color;
      ctx.stroke(p);
    }
    ctx.restore();
  }

  // ---- node dots where there is room, and species tips at deep zoom
  if (sc.rest) {
    ctx.save();
    ctx.globalAlpha = dim ? 0.35 : 1;
    ctx.lineWidth = 1.5 * u;
    ctx.fillStyle = pal.bg;
    const prevAt = new Map<number, number>();
    L.focus.eachBefore((n) => {
      if (n === L.focus || !n.children) return;
      const i = n.data.i;
      const a = at(pose.a, i);
      const s = rad(at(pose.r, i));
      const last = prevAt.get(n.depth);
      prevAt.set(n.depth, a);
      const roomy = n.depth <= Math.max(L.bandDepth, CLASS_DEPTH) || last === undefined || (a - last) * s > 16 * u;
      if (!roomy || s < 6 * u) return;
      const [x, y] = polar(cam, a, s);
      if (!inView(x, y, 8 * u)) return;
      const r = (n.depth <= Math.max(L.bandDepth, CLASS_DEPTH) ? 3.2 : 2.4) * u;
      ctx.strokeStyle = nodeColor(pal, n);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    });
    const tipA = smoothstep(7 * u, 12 * u, slotPx);
    if (tipA > 0.01) {
      ctx.globalAlpha = (dim ? 0.35 : 1) * tipA;
      for (let k = l0; k <= l1; k++) {
        const leaf = model.leaves[k];
        if (!leaf) continue;
        const [x, y] = polar(cam, at(pose.la, k), z.T);
        if (!inView(x, y, 6 * u)) continue;
        ctx.fillStyle = nodeColor(pal, leaf);
        ctx.beginPath();
        ctx.arc(x, y, 2.4 * u, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---- highlighted lineage and subtree
  if (active && sc.rest && (active === L.focus || isInside(L.focus, active))) {
    const color = nodeColor(pal, active);
    const sub = new Path2D();
    if (active.children) {
      active.each((d) => {
        if (d !== active && d.parent) linkPath(sub, d);
      });
    }
    const line = new Path2D();
    for (let n: TNode | null = active; n && n !== L.focus && n.parent; n = n.parent) linkPath(line, n);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = linkW + 0.9 * u;
    ctx.stroke(sub);
    ctx.lineWidth = 3 * u;
    ctx.stroke(line);
    const [x, y] = pos(active.data.i);
    ctx.fillStyle = pal.bg;
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.arc(x, y, (active.children ? 5.5 : 4) * u, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ---- clade arcs
  L.bands.forEach((b, idx) => {
    const [a0, a1] = nodeSpan(model, pose, b.node);
    if (a1 - a0 < 1e-6) return;
    ctx.fillStyle = nodeColor(pal, b.node);
    ctx.globalAlpha = idx % 2 ? 0.55 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, z.arcOut, A(a0), A(a1));
    ctx.arc(cx, cy, z.arcIn, A(a1), A(a0), true);
    ctx.closePath();
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // ---- names
  let stems: PlacedLabel[] = [];
  const halo = (w: number) => {
    ctx.strokeStyle = pal.bg;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
  };
  if (sc.rest) {
    // Clade names on the arcs, while the species names are not shown.
    const bandA = 1 - z.leafA;
    if (bandA > 0.01) {
      const bfs = fs * 1.04;
      const font = M.font(900, bfs);
      const s = z.labIn + bfs * 0.42;
      ctx.save();
      ctx.globalAlpha = bandA;
      ctx.font = font;
      ctx.fillStyle = pal.heading;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      for (const b of L.bands) {
        const [a0, a1] = nodeSpan(model, pose, b.node);
        const run = visibleArc(cam, vp, s, a0 + th, a1 + th, 2 * u);
        if (!run) continue;
        const room = (run[1] - run[0]) * s * 0.94;
        const text = bandTexts(b.node).find((tx) => M.width(font, tx) <= room);
        if (!text) continue;
        arcText(ctx, M, font, text, cx, cy, s, (run[0] + run[1]) / 2);
      }
      ctx.restore();
    }

    // Clade names along their stems.
    const stemFont = M.font(800, fs * 0.98);
    const stemFontI = M.font(800, fs * 0.98, true);
    stems = placeStemLabels({
      focus: L.focus,
      pose,
      G,
      cam,
      vp,
      rad,
      measure: (text, italic) => M.width(italic ? stemFontI : stemFont, text),
      skipDepth: bandA > 0.5 ? L.bandDepth || undefined : undefined,
    });
    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    for (const l of stems) {
      ctx.globalAlpha = l.alpha * (dim && !(active && (l.node === active || isInside(active, l.node) || isInside(l.node, active))) ? 0.45 : 1);
      ctx.font = l.italic ? stemFontI : stemFont;
      ctx.save();
      ctx.translate(l.cx, l.cy);
      ctx.rotate(l.rot);
      halo(4 * u);
      ctx.strokeText(l.text, 0, 0);
      ctx.fillStyle = l.node === active ? nodeColor(pal, l.node) : pal.heading;
      ctx.fillText(l.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Species names at deep zoom.
    if (z.leafA > 0.01) drawLeafLabels(ctx, sc, pal, M, z);

    // Guide labels: in the opening at 12 o'clock, else at the top of the visible part of the ring.
    {
      const font = M.font(800, fs * 0.9);
      ctx.save();
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const placed: [number, number, number][] = [];
      for (const g of guides) {
        if (g.s < 10 * u) continue;
        const tw = M.width(font, g.label);
        let pt = polar(cam, 0, g.s);
        const inset = tw / 2 + 6 * u;
        const okGap = pt[0] >= inset && pt[0] <= vp.w - inset && pt[1] >= 10 * u && pt[1] <= vp.h - 10 * u;
        if (!okGap) {
          const run = visibleArc(cam, vp, g.s, L.start + th, L.end + th, inset);
          if (!run) continue;
          const q = cy - g.s * Math.cos(run[0]) <= cy - g.s * Math.cos(run[1]) ? run[0] : run[1];
          pt = [cx + g.s * Math.sin(q), cy - g.s * Math.cos(q) + 10 * u];
        }
        if (placed.some(([x, y, w]) => Math.abs(x - pt[0]) < (w + tw) / 2 + 6 * u && Math.abs(y - pt[1]) < fs * 1.1)) continue;
        // Clade names win over the ring names.
        const box: PlacedLabel = { node: L.focus, cx: pt[0], cy: pt[1], rot: 0, w: tw, h: fs, text: g.label, italic: false, alpha: 1 };
        if (stems.some((l) => boxesOverlap(l, box, 2 * u))) continue;
        placed.push([pt[0], pt[1], tw]);
        halo(4.5 * u);
        ctx.strokeText(g.label, pt[0], pt[1]);
        ctx.fillStyle = pal.tick;
        ctx.fillText(g.label, pt[0], pt[1]);
      }
      // Ring scale at deep zoom: the tick values next to the grid circles.
      if (gridA > 0.3 && sc.ticks.length && cam.k > sc.kMin * 1.3) {
        ctx.globalAlpha = gridA;
        const tfont = M.font(800, fs * 0.8);
        ctx.font = tfont;
        for (const tk of sc.ticks) {
          const s = z.ringIn + ringH * (0.1 + 0.9 * tk.t);
          const run = visibleArc(cam, vp, s, L.start + th, L.end + th, 14 * u);
          if (!run) continue;
          // At the end of the visible run that is higher on screen, written along the circle.
          const tw = M.width(tfont, tk.label);
          const top = cy - s * Math.cos(run[0]) <= cy - s * Math.cos(run[1]);
          const room = (run[1] - run[0]) * s;
          if (room < tw + 24 * u) continue;
          const q = top ? run[0] + (tw / 2 + 10 * u) / s : run[1] - (tw / 2 + 10 * u) / s;
          ctx.fillStyle = pal.muted;
          arcText(ctx, M, tfont, tk.label, cx, cy, s, q, pal.bg, 3.5 * u);
        }
      }
      ctx.restore();
    }
  }

  // ---- outline of the hovered bar or clade arc; the selected species
  const h = sc.hover;
  if (h && sc.rest) {
    ctx.save();
    ctx.strokeStyle = pal.axis;
    ctx.lineWidth = 1.6 * u;
    if (h.zone === "band") {
      const [a0, a1] = nodeSpan(model, pose, h.node);
      ctx.beginPath();
      ctx.arc(cx, cy, z.arcOut + u, A(a0), A(a1));
      ctx.arc(cx, cy, z.arcIn - u, A(a1), A(a0), true);
      ctx.closePath();
      ctx.stroke();
    } else if (!h.node.children) {
      const k = h.node.data.leafIndex;
      const w = Math.min(Math.max(at(pose.lw, k), (1.2 * u) / z.ringIn), (11 * u) / z.ringIn);
      const a = at(pose.la, k);
      const v = sc.vals[k] ?? 0;
      ctx.beginPath();
      ctx.arc(cx, cy, z.ringIn + ringH * (0.1 + 0.9 * (Number.isFinite(v) ? v : 0)) + u, A(a - w), A(a + w));
      ctx.arc(cx, cy, z.ringIn - u, A(a + w), A(a - w), true);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
  const sel = sc.selected;
  if (sel && !sel.children && sc.rest && isInside(L.focus, sel)) {
    const k = sel.data.leafIndex;
    const a = at(pose.la, k);
    const w = Math.min(Math.max(at(pose.lw, k), (2 * u) / z.ringIn), (12 * u) / z.ringIn);
    ctx.save();
    ctx.strokeStyle = pal.highlight;
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(cx, cy, z.ringOut + 2 * u, A(a - w), A(a + w));
    ctx.arc(cx, cy, z.ringIn - 2 * u, A(a + w), A(a - w), true);
    ctx.closePath();
    ctx.stroke();
    const [x, y] = polar(cam, a, z.T);
    ctx.fillStyle = pal.highlightHalo;
    ctx.beginPath();
    ctx.arc(x, y, 9 * u, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ---- the root of the view
  const [rx, ry] = pos(fi);
  if (inView(rx, ry, 10 * u)) {
    ctx.fillStyle = nodeColor(pal, L.focus);
    ctx.strokeStyle = pal.bg;
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.arc(rx, ry, 6 * u, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  return { stems, z };
};

const isInside = (a: TNode, b: TNode): boolean => {
  for (let p: TNode | null = b; p; p = p.parent) if (p === a) return true;
  return false;
};

/** Text centred on screen angle p along a circle of radius s, upright in the lower half. */
const arcText = (
  ctx: CanvasRenderingContext2D,
  M: Measurer,
  font: string,
  text: string,
  cx: number,
  cy: number,
  s: number,
  p: number,
  halo?: string,
  haloW = 0,
) => {
  const n = ((p % TAU) + TAU) % TAU;
  const flip = n > Math.PI / 2 && n < (3 * Math.PI) / 2;
  const total = M.width(font, text);
  let off = -total / 2;
  for (const ch of text) {
    const w = M.width(font, ch);
    const q = flip ? p - (off + w / 2) / s : p + (off + w / 2) / s;
    off += w;
    const x = cx + s * Math.sin(q);
    const y = cy - s * Math.cos(q);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(flip ? q - Math.PI : q);
    if (halo && haloW > 0) {
      ctx.strokeStyle = halo;
      ctx.lineWidth = haloW;
      ctx.strokeText(ch, 0, 0);
    }
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
};

const drawLeafLabels = (ctx: CanvasRenderingContext2D, sc: Scene, pal: Palette, M: Measurer, z: Zones) => {
  const { model, L, pose, G, cam, vp } = sc;
  const u = G.u;
  const fs = G.fs;
  const fi = L.focus.data.i;
  const l0 = model.leafRange[2 * fi] ?? 0;
  const l1 = model.leafRange[2 * fi + 1] ?? 0;
  const maxW = z.labOut - z.labIn - 2 * u;
  if (maxW < 12 * u) return;
  const one = z.leafA * (1 - z.twoA);
  const two = z.leafA * z.twoA;
  const f1 = M.font(700, fs * 0.96, true);
  const f1on = M.font(900, fs * 0.96, true);
  const fCommon = M.font(800, fs * 1.02);
  const fCommonOn = M.font(900, fs * 1.02);
  const fSci = M.font(700, fs * 0.9, true);
  const fVal = M.font(900, fs * 0.9);
  const active = sc.hover?.node ?? null;
  const halo = 3.5 * u;
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (let k = l0; k <= l1; k++) {
    const leaf = model.leaves[k];
    if (!leaf) continue;
    const p = (pose.la[k] ?? 0) + cam.th;
    const [ax, ay] = polar(cam, pose.la[k] ?? 0, z.labIn);
    const [bx, by] = polar(cam, pose.la[k] ?? 0, z.labIn + maxW);
    const m = fs * 1.5;
    if ((ax < -m && bx < -m) || (ax > vp.w + m && bx > vp.w + m) || (ay < -m && by < -m) || (ay > vp.h + m && by > vp.h + m)) continue;
    const { rot, flip } = radialRotation(p);
    const on = leaf === active || leaf === sc.selected;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(rot);
    ctx.textAlign = flip ? "right" : "left";
    ctx.strokeStyle = pal.bg;
    ctx.lineWidth = halo;
    if (one > 0.01) {
      ctx.globalAlpha = one;
      const font = on ? f1on : f1;
      ctx.font = font;
      const text = M.fit(font, abbrevName(leaf.data.name), maxW);
      ctx.fillStyle = on ? pal.heading : pal.muted;
      ctx.fillText(text, 0, 0);
    }
    if (two > 0.01) {
      ctx.globalAlpha = two;
      const sp = leaf.data.sp;
      const common = sp?.common || "";
      const line1 = common || leaf.data.name;
      const fc = on ? fCommonOn : fCommon;
      ctx.font = fc;
      ctx.fillStyle = on ? nodeColor(pal, leaf) : pal.heading;
      const t1 = M.fit(fc, line1, maxW);
      ctx.strokeText(t1, 0, -fs * 0.58);
      ctx.fillText(t1, 0, -fs * 0.58);
      // Second line: scientific name (when the first line is the common name) and the ring value.
      const val = sc.valueText(leaf);
      const vw = val ? M.width(fVal, val) + 6 * u : 0;
      const sci = common ? M.fit(fSci, leaf.data.name, maxW - vw) : "";
      const sw = sci ? M.width(fSci, sci) : 0;
      const y2 = fs * 0.62;
      ctx.font = fSci;
      ctx.fillStyle = pal.muted;
      if (flip) {
        // Right-aligned: the value sits next to the tip, the name further out.
        if (val) {
          ctx.font = fVal;
          ctx.fillStyle = pal.ink;
          ctx.fillText(val, 0, y2);
        }
        if (sci) {
          ctx.font = fSci;
          ctx.fillStyle = pal.muted;
          ctx.fillText(sci, -vw, y2);
        }
      } else {
        if (sci) ctx.fillText(sci, 0, y2);
        if (val) {
          ctx.font = fVal;
          ctx.fillStyle = pal.ink;
          ctx.fillText(val, sci ? sw + 6 * u : 0, y2);
        }
      }
    }
    ctx.restore();
  }
  ctx.restore();
};

/** Skeleton while the data loads. */
export const drawSkeleton = (ctx: CanvasRenderingContext2D, vp: Viewport, dpr: number, G: Geometry, pal: Pick<Palette, "sunken" | "muted" | "family">, text: string) => {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, vp.w, vp.h);
  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const z = zones(G, 1 / 922, 1);
  ctx.strokeStyle = pal.sunken;
  ctx.lineWidth = 14 * G.u;
  for (const r of [G.R * 0.62, (z.ringIn + z.ringOut) / 2]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = pal.muted;
  ctx.font = `800 ${Math.round(Math.min(vp.w, vp.h) * 0.034)}px ${pal.family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
};
