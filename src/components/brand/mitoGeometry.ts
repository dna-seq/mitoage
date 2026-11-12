/**
 * Geometry of the MitoAge mitochondrion, centred on (0,0) and lying horizontally.
 *
 * Anatomy, outside in:
 *   outer membrane (stroke of `outer`), intermembrane space (fill of `outer`),
 *   inner membrane (stroke of `inner`) enclosing the matrix (fill of `inner`),
 *   cristae: finger-like folds of the inner membrane reaching into the matrix, alternating
 *   from the top and bottom. Each crista is filled with the intermembrane colour and clipped
 *   to the inner membrane, so its mouth opens into the intermembrane space like a real fold.
 *   The matrix holds circular mtDNA molecules (nucleoids), ribosomes and granules.
 */
import { seededRandom } from "~/lib/random";

export interface MitoGeometry {
  /** Outer membrane outline. */
  outer: string;
  /** Inner membrane outline (matrix boundary). */
  inner: string;
  /** Inner outline grown by half a stroke; clip for the cristae. */
  innerClip: string;
  cristae: string[];
  nucleoids: { cx: number; cy: number; r: number; rot: number }[];
  ribosomes: { cx: number; cy: number; r: number }[];
  granules: { cx: number; cy: number; r: number }[];
  /** Specular highlight along the upper edge. */
  gloss: string;
  halfLength: number;
  radius: number;
}

export interface MitoOptions {
  /** "full" for the badge, "simple" for small sizes (icon, favicon). */
  detail?: "full" | "simple";
  innerStroke?: number;
}

/** Capsule with gently bowed long edges. */
const capsule = (L: number, R: number, bow: number): string => {
  const c = L - R;
  return [
    `M${-c} ${-R}`,
    `Q0 ${-R - bow} ${c} ${-R}`,
    `A${R} ${R} 0 0 1 ${c} ${R}`,
    `Q0 ${R + bow} ${-c} ${R}`,
    `A${R} ${R} 0 0 1 ${-c} ${-R}`,
    "Z",
  ].join("");
};

/** y of the bowed top edge (negative) at x, for |x| <= c. */
const edgeY = (x: number, c: number, R: number, bow: number): number => {
  const t = (x + c) / (2 * c);
  return -R - 2 * bow * t * (1 - t);
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** One crista from the top (dir = 1) or bottom (dir = -1) membrane. */
const crista = (x: number, edge: number, depth: number, w: number, lean: number, dir: 1 | -1): string => {
  const y0 = edge - 14 * dir; // start outside the inner membrane; clipped away
  const tip = edge + depth * dir;
  const hw = w / 2;
  const m1 = edge + depth * 0.35 * dir;
  const m2 = edge + depth * 0.75 * dir;
  const sweep = dir === 1 ? 0 : 1;
  // Sides bow one way near the membrane and the other way near the tip: a soft S-shaped fold.
  const b = -lean * 0.55;
  return [
    `M${r1(x - hw)} ${r1(y0)}`,
    `C${r1(x - hw + b)} ${r1(m1)} ${r1(x + lean - hw)} ${r1(m2)} ${r1(x + lean - hw)} ${r1(tip)}`,
    `A${r1(hw)} ${r1(hw)} 0 0 ${sweep} ${r1(x + lean + hw)} ${r1(tip)}`,
    `C${r1(x + lean + hw)} ${r1(m2)} ${r1(x + hw + b)} ${r1(m1)} ${r1(x + hw)} ${r1(y0)}`,
    "Z",
  ].join("");
};

export const mitoGeometry = (opts: MitoOptions = {}): MitoGeometry => {
  const detail = opts.detail ?? "full";
  const innerStroke = opts.innerStroke ?? 3;
  const L = 100;
  const R = 46;
  const bow = 3.5;
  const gap = detail === "full" ? 7.5 : 9;
  const Li = L - gap;
  const Ri = R - gap;
  const ci = Li - Ri;

  const outer = capsule(L, R, bow);
  const inner = capsule(Li, Ri, bow * 0.8);
  const innerClip = capsule(Li + innerStroke / 2, Ri + innerStroke / 2, bow * 0.8);

  const rand = seededRandom(detail === "full" ? 1611 : 7);
  const cristae: string[] = [];
  /** Approximate centre lines of the cristae, used to keep ribosomes out of them. */
  const spines: { x: number; edge: number; tip: number; lean: number }[] = [];
  const topXs = detail === "full" ? [-48, -16, 16, 48] : [-38, 0, 38];
  const botXs = detail === "full" ? [-32, 0, 32] : [-19, 19];
  const w = detail === "full" ? 8.5 : 11;
  const depthBase = Ri * 2 * (detail === "full" ? 0.64 : 0.62);
  const leanAmp = detail === "full" ? 5 : 4;
  topXs.forEach((x, i) => {
    const e = edgeY(x, ci, Ri, bow * 0.8);
    const depth = depthBase * (0.88 + rand() * 0.14) - (Math.abs(x) > 40 ? 10 : 0);
    const lean = (i % 2 ? 1 : -1) * (leanAmp + rand() * 2.5);
    cristae.push(crista(x, e, depth, w, lean, 1));
    spines.push({ x, edge: e, tip: e + depth, lean });
  });
  botXs.forEach((x, i) => {
    const e = -edgeY(x, ci, Ri, bow * 0.8);
    const depth = depthBase * (0.88 + rand() * 0.14);
    const lean = (i % 2 ? -1 : 1) * (leanAmp + rand() * 2.5);
    cristae.push(crista(x, e, depth, w, lean, -1));
    spines.push({ x, edge: e, tip: e - depth, lean });
  });

  const nucleoids =
    detail === "full"
      ? [
          { cx: -72, cy: -7, r: 9, rot: -20 },
          { cx: -68, cy: 17, r: 5.5, rot: 30 },
          { cx: 71, cy: 9, r: 10, rot: 15 },
        ]
      : [{ cx: 64, cy: 4, r: 11, rot: 0 }];

  const ribosomes: { cx: number; cy: number; r: number }[] = [];
  const granules: { cx: number; cy: number; r: number }[] = [];
  if (detail === "full") {
    // Ribosomes sit in the matrix channels between interdigitated cristae.
    const all = [...topXs, ...botXs].sort((a, b) => a - b);
    for (let i = 0; i < all.length - 1; i++) {
      const a = all[i] ?? 0;
      const b = all[i + 1] ?? 0;
      const gx = (a + b) / 2;
      const n = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < n; k++) {
        const cx = gx + (rand() - 0.5) * 1.2;
        const cy = -26 + rand() * 52;
        const clear = spines.every((sp) => {
          const lo = Math.min(sp.edge, sp.tip) - w;
          const hi = Math.max(sp.edge, sp.tip) + w;
          if (cy < lo || cy > hi) return true;
          const u = Math.min(1, Math.max(0, (cy - sp.edge) / (sp.tip - sp.edge)));
          return Math.abs(cx - (sp.x + sp.lean * u)) > w / 2 + 3.5;
        });
        if (clear) ribosomes.push({ cx: r1(cx), cy: r1(cy), r: 1.5 });
      }
    }
    // A scatter of ribosomes and granules in the end caps.
    const caps = [
      [-84, -18], [-80, 4], [-60, -24], [-58, 28], [-85, 18],
      [84, -10], [80, 24], [60, -26], [58, 30], [86, 4],
    ] as const;
    for (const [cx, cy] of caps) ribosomes.push({ cx, cy, r: 1.5 });
    granules.push({ cx: -56, cy: -10, r: 2.8 }, { cx: 57, cy: -12, r: 3.2 }, { cx: 88, cy: -2, r: 2.2 });
  }

  const c = L - R;
  const gloss = `M${-c + 2} ${-R + 4}Q0 ${-R - bow + 3} ${c - 6} ${-R + 4}Q${c + 18} ${-R + 9} ${c + 26} ${-R + 22}Q${c + 10} ${-R + 9} ${c - 8} ${-R + 8}Q0 ${-R + 3} ${-c + 2} ${-R + 9}Q${-c - 18} ${-R + 16} ${-c - 30} ${-R + 30}Q${-c - 22} ${-R + 9} ${-c + 2} ${-R + 4}Z`;

  return { outer, inner, innerClip, cristae, nucleoids, ribosomes, granules, gloss, halfLength: L, radius: R };
};
