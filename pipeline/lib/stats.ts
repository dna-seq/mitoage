/** Statistics helpers: composition, correlation, p-values, BH correction, PIC. */

export interface BaseCounts {
  a: number;
  c: number;
  g: number;
  t: number;
  other: number;
}

export function countBases(seq: string): BaseCounts {
  const out: BaseCounts = { a: 0, c: 0, g: 0, t: 0, other: 0 };
  for (let i = 0; i < seq.length; i++) {
    const ch = seq.charCodeAt(i) | 0x20; // lower-case
    if (ch === 97) out.a++;
    else if (ch === 99) out.c++;
    else if (ch === 103) out.g++;
    else if (ch === 116 || ch === 117) out.t++;
    else out.other++;
  }
  return out;
}

/** GC percent over unambiguous bases (0-100). */
export function gcPercent(b: BaseCounts): number {
  const n = b.a + b.c + b.g + b.t;
  return n === 0 ? 0 : (100 * (b.g + b.c)) / n;
}

export const skew = (x: number, y: number): number | null => (x + y === 0 ? null : (x - y) / (x + y));

export function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

/** Round to a number of significant digits (keeps small p-values meaningful). */
export function roundSig(x: number, sig: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  return Number(x.toPrecision(sig));
}

// ---------- special functions ----------

function logGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let y = x;
  const tmp0 = x + 5.5;
  const tmp = tmp0 - (x + 0.5) * Math.log(tmp0);
  let ser = 1.000000000190015;
  for (const c of cof) ser += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 3e-16;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-tailed p-value of Student's t with `df` degrees of freedom. */
export function tTestTwoTailed(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  if (df <= 0) return NaN;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Two-tailed p-value of a correlation coefficient r from n pairs, with `k` covariates partialled out. */
export function correlationPValue(r: number, n: number, k = 0): number {
  const df = n - 2 - k;
  if (df <= 0) return NaN;
  if (Math.abs(r) >= 1) return 0;
  return tTestTwoTailed(r * Math.sqrt(df / (1 - r * r)), df);
}

// ---------- correlations ----------

export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = x.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i]!;
    my += y[i]!;
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return NaN;
  return sxy / Math.sqrt(sxx * syy);
}

/** Average ranks (1-based), ties get the mean rank. */
export function rank(x: ArrayLike<number>): Float64Array {
  const n = x.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a]! - x[b]!);
  const r = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && x[idx[j + 1]!] === x[idx[i]!]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]!] = avg;
    i = j + 1;
  }
  return r;
}

export function spearman(x: ArrayLike<number>, y: ArrayLike<number>): number {
  return pearson(rank(x), rank(y));
}

/** Partial correlation of x and y controlling for z (first order). */
export function partialCorrelation(x: ArrayLike<number>, y: ArrayLike<number>, z: ArrayLike<number>): number {
  const rxy = pearson(x, y);
  const rxz = pearson(x, z);
  const ryz = pearson(y, z);
  const den = Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz));
  return den === 0 ? NaN : (rxy - rxz * ryz) / den;
}

/** Benjamini-Hochberg adjusted q-values (NaN p-values stay NaN and are not counted). */
export function benjaminiHochberg(p: number[]): number[] {
  const valid = p.map((v, i) => [v, i] as const).filter(([v]) => Number.isFinite(v));
  const m = valid.length;
  const q = p.map(() => NaN);
  valid.sort((a, b) => a[0] - b[0]);
  let prev = 1;
  for (let k = m - 1; k >= 0; k--) {
    const [v, i] = valid[k]!;
    const adj = Math.min(prev, (v * m) / (k + 1));
    prev = adj;
    q[i] = Math.min(1, adj);
  }
  return q;
}

// ---------- phylogenetic independent contrasts ----------

export interface PhyloNode {
  /** Branch length to the parent (any unit). */
  length: number;
  children: PhyloNode[];
  /** Leaf label (species id). */
  leaf?: number;
}

/**
 * Felsenstein (1985) independent contrasts for two traits on a tree, pruned to leaves where
 * both traits are known. Returns the correlation through the origin and its p-value (df = m - 1).
 */
export function picCorrelation(
  tree: PhyloNode,
  x: Map<number, number>,
  y: Map<number, number>,
): { r: number; p: number; contrasts: number } | null {
  const cx: number[] = [];
  const cy: number[] = [];
  // Returns [x, y, extra branch length] for a subtree or null if it has no usable leaf.
  const visit = (node: PhyloNode): [number, number, number] | null => {
    if (node.leaf !== undefined) {
      const vx = x.get(node.leaf);
      const vy = y.get(node.leaf);
      if (vx === undefined || vy === undefined) return null;
      return [vx, vy, node.length];
    }
    const kids = node.children.map(visit).filter((v): v is [number, number, number] => v !== null);
    if (kids.length === 0) return null;
    // Resolve polytomies by sequential pairing (zero-length internal branches).
    let acc = kids[0]!;
    for (let i = 1; i < kids.length; i++) {
      const b = kids[i]!;
      const v1 = acc[2];
      const v2 = b[2];
      const sum = v1 + v2;
      if (sum <= 0) {
        // Identical positions: average without generating a contrast.
        acc = [(acc[0] + b[0]) / 2, (acc[1] + b[1]) / 2, 0];
        continue;
      }
      const sd = Math.sqrt(sum);
      cx.push((acc[0] - b[0]) / sd);
      cy.push((acc[1] - b[1]) / sd);
      acc = [(acc[0] * v2 + b[0] * v1) / sum, (acc[1] * v2 + b[1] * v1) / sum, (v1 * v2) / sum];
    }
    return [acc[0], acc[1], acc[2] + node.length];
  };
  visit(tree);
  const m = cx.length;
  if (m < 3) return null;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < m; i++) {
    sxy += cx[i]! * cy[i]!;
    sxx += cx[i]! * cx[i]!;
    syy += cy[i]! * cy[i]!;
  }
  if (sxx === 0 || syy === 0) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  const df = m - 1;
  const p = Math.abs(r) >= 1 ? 0 : tTestTwoTailed(r * Math.sqrt(df / (1 - r * r)), df);
  return { r, p, contrasts: m };
}

/** A tree flattened to post-order arrays for fast repeated contrasts. */
export interface CompiledTree {
  /** Child node indices for each node, in post-order (children before parents). */
  children: number[][];
  length: Float64Array;
  /** Index into the value arrays for leaves, -1 for internal nodes. */
  leafIndex: Int32Array;
  root: number;
}

export function compileTree(tree: PhyloNode, indexOfLeaf: (leaf: number) => number | undefined): CompiledTree {
  const children: number[][] = [];
  const length: number[] = [];
  const leafIndex: number[] = [];
  const visit = (n: PhyloNode): number => {
    const kids = n.children.map(visit);
    const i = children.length;
    children.push(kids);
    length.push(n.length);
    leafIndex.push(n.leaf !== undefined ? (indexOfLeaf(n.leaf) ?? -1) : -1);
    return i;
  };
  const root = visit(tree);
  return { children, length: Float64Array.from(length), leafIndex: Int32Array.from(leafIndex), root };
}

/** Same result as picCorrelation, on a compiled tree with NaN marking missing values. */
export function picFast(t: CompiledTree, x: ArrayLike<number>, y: ArrayLike<number>): { r: number; p: number; contrasts: number } | null {
  const n = t.children.length;
  const has = new Uint8Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const extra = new Float64Array(n);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const li = t.leafIndex[i]!;
    const kids = t.children[i]!;
    if (kids.length === 0) {
      if (li < 0) continue;
      const a = x[li]!;
      const b = y[li]!;
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      has[i] = 1;
      vx[i] = a;
      vy[i] = b;
      extra[i] = t.length[i]!;
      continue;
    }
    let first = true;
    let ax = 0;
    let ay = 0;
    let av = 0;
    for (const k of kids) {
      if (!has[k]) continue;
      if (first) {
        ax = vx[k]!;
        ay = vy[k]!;
        av = extra[k]!;
        first = false;
        continue;
      }
      const v2 = extra[k]!;
      const sum = av + v2;
      if (sum <= 0) {
        ax = (ax + vx[k]!) / 2;
        ay = (ay + vy[k]!) / 2;
        av = 0;
        continue;
      }
      const sd = Math.sqrt(sum);
      const cx = (ax - vx[k]!) / sd;
      const cy = (ay - vy[k]!) / sd;
      sxy += cx * cy;
      sxx += cx * cx;
      syy += cy * cy;
      m++;
      ax = (ax * v2 + vx[k]! * av) / sum;
      ay = (ay * v2 + vy[k]! * av) / sum;
      av = (av * v2) / sum;
    }
    if (first) continue;
    has[i] = 1;
    vx[i] = ax;
    vy[i] = ay;
    extra[i] = av + t.length[i]!;
  }
  if (m < 3 || sxx === 0 || syy === 0) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  const df = m - 1;
  const p = Math.abs(r) >= 1 ? 0 : tTestTwoTailed(r * Math.sqrt(df / (1 - r * r)), df);
  return { r, p, contrasts: m };
}
