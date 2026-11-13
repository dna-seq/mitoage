/**
 * Which clade names fit on screen for the zoomable radial tree. A clade is named along its stem
 * (the branch from its parent's arc to its node), centred on the part of the stem that is on
 * screen, once the stem is long enough for the name and its neighbours are far enough apart.
 * Shallow ranks and large clades are placed first; names never overlap. Pure; safe for islands.
 */
import { clipRay, smoothstep, type Camera, type Geometry, type Viewport } from "./camera";
import type { Pose } from "./layout";
import type { TNode } from "./types";

export interface PlacedLabel {
  node: TNode;
  /** Centre of the text box. */
  cx: number;
  cy: number;
  /** Rotation of the text baseline, radians (canvas convention). */
  rot: number;
  /** Text width and box height, px. */
  w: number;
  h: number;
  text: string;
  italic: boolean;
  /** Fades in as the name gets room, 0..1. */
  alpha: number;
}

export interface StemLabelInput {
  /** Clade at the centre of the layout; it has no stem. */
  focus: TNode;
  pose: Pick<Pose, "a" | "r">;
  G: Geometry;
  cam: Camera;
  vp: Viewport;
  /** Screen radius of a normalised radius. */
  rad: (r: number) => number;
  /** Text width in px at the label font size. */
  measure: (text: string, italic: boolean) => number;
  /** Skip clades at this depth (their names are shown elsewhere). */
  skipDepth?: number | undefined;
  /** Margin kept free at the viewport edges. */
  margin?: number;
  max?: number;
}

/** Text rotation for a radial label at screen angle p, flipped on the left so it reads upright. */
export const radialRotation = (p: number): { rot: number; flip: boolean } => {
  const n = ((p % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const flip = n > Math.PI;
  return { rot: flip ? p + Math.PI / 2 : p - Math.PI / 2, flip };
};

/** Oriented boxes overlap (separating axis test). */
export const boxesOverlap = (a: PlacedLabel, b: PlacedLabel, gap = 0): boolean => {
  const axes = [a.rot, a.rot + Math.PI / 2, b.rot, b.rot + Math.PI / 2];
  const half = (l: PlacedLabel, ax: number): number => {
    const c = Math.abs(Math.cos(ax - l.rot));
    const s = Math.abs(Math.sin(ax - l.rot));
    return (l.w / 2 + gap) * c + (l.h / 2 + gap) * s;
  };
  for (const ax of axes) {
    const ux = Math.cos(ax);
    const uy = Math.sin(ax);
    const d = Math.abs((b.cx - a.cx) * ux + (b.cy - a.cy) * uy);
    if (d > half(a, ax) + half(b, ax)) return false;
  }
  return true;
};

/** Is the point inside the label's box (with a little slack)? */
export const pointInLabel = (l: PlacedLabel, x: number, y: number, slack = 2): boolean => {
  const dx = x - l.cx;
  const dy = y - l.cy;
  const along = dx * Math.cos(l.rot) + dy * Math.sin(l.rot);
  const across = -dx * Math.sin(l.rot) + dy * Math.cos(l.rot);
  return Math.abs(along) <= l.w / 2 + slack && Math.abs(across) <= l.h / 2 + slack;
};

export const placeStemLabels = (inp: StemLabelInput): PlacedLabel[] => {
  const { focus, pose, G, cam, vp, measure } = inp;
  const m = inp.margin ?? 4 * G.u;
  const max = inp.max ?? 320;
  const fs = G.fs;
  const rad = inp.rad;
  const h = fs * 1.25;

  // Angular room on each side of a node: distance to its neighbours at the same depth.
  const byDepth = new Map<number, TNode[]>();
  focus.each((n) => {
    if (n === focus) return;
    const list = byDepth.get(n.depth);
    if (list) list.push(n);
    else byDepth.set(n.depth, [n]);
  });
  const room = new Map<TNode, number>();
  for (const list of byDepth.values()) {
    for (let j = 0; j < list.length; j++) {
      const n = list[j] as TNode;
      const a = pose.a[n.data.i] ?? 0;
      const prev = list[j - 1];
      const next = list[j + 1];
      const dl = prev ? a - (pose.a[prev.data.i] ?? 0) : Infinity;
      const dr = next ? (pose.a[next.data.i] ?? 0) - a : Infinity;
      room.set(n, Math.min(dl, dr));
    }
  }

  const cands: TNode[] = [];
  focus.each((n) => {
    if (n === focus || !n.children || !n.parent) return;
    if (inp.skipDepth !== undefined && n.depth === inp.skipDepth) return;
    cands.push(n);
  });
  cands.sort((x, y) => x.depth - y.depth || (y.value ?? 0) - (x.value ?? 0));

  const placed: PlacedLabel[] = [];
  for (const n of cands) {
    if (placed.length >= max) break;
    const parent = n.parent as TNode;
    const sP = Math.max(0, rad(pose.r[parent.data.i] ?? 0));
    const sN = rad(pose.r[n.data.i] ?? 0);
    const p = (pose.a[n.data.i] ?? 0) + cam.th;
    const minLen = 3 * fs;
    if (sN - sP < minLen) continue;
    const vis = clipRay(cam, vp, p, sP + 3 * G.u, sN - 5 * G.u, m);
    if (!vis || vis[1] - vis[0] < minLen) continue;
    const italic = n.data.rank === "genus";
    const text = n.data.name;
    const w = measure(text, italic);
    const pad = 4 * G.u;
    if (vis[1] - vis[0] < w + 2 * pad) continue;
    const mid = (sP + sN) / 2;
    const sc = Math.min(Math.max(mid, vis[0] + w / 2 + pad), vis[1] - w / 2 - pad);
    // Neighbouring stems converge inwards: check the room at the inner end of the text.
    const inner = sc - w / 2;
    const across = (room.get(n) ?? Infinity) * inner;
    if (across < h * 1.05) continue;
    // A short fade, so names do not pop in while zooming; at rest a name is all but always whole.
    const alpha = Math.min(smoothstep(0, 5 * G.u, vis[1] - vis[0] - w - 2 * pad), smoothstep(h * 1.05, h * 1.15, across));
    if (alpha < 0.5) continue;
    const { rot } = radialRotation(p);
    const cx = cam.x + sc * Math.sin(p);
    const cy = cam.y - sc * Math.cos(p);
    const label: PlacedLabel = { node: n, cx, cy, rot, w, h, text, italic, alpha };
    if (placed.some((q) => boxesOverlap(q, label, 2 * G.u))) continue;
    placed.push(label);
  }
  return placed;
};
