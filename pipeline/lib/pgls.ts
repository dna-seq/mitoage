/**
 * Phylogenetic generalised least squares with Pagel's lambda, in time linear in the number of species.
 *
 * The model is y = b0 + X b + e with e ~ N(0, s2 V(lambda)), where V(lambda) is the Brownian covariance of the
 * tree (shared path length from the root) with its off-diagonal multiplied by lambda. V(lambda) is itself the
 * Brownian covariance of a transformed tree: every internal branch multiplied by lambda, every tip branch b
 * replaced by lambda b + (1 - lambda) d, where d is the tip's depth from the root. So the generalised least
 * squares fit is ordinary least squares through the origin on the independent contrasts of that tree
 * (Felsenstein 1985), and the log determinant of V is the sum of the logs of the contrasts' variances plus the
 * log of the root's (Felsenstein 1973; Freckleton 2012). The tree is the one pruned to the species fitted,
 * rooted at their most recent common ancestor: the path above that ancestor is not part of V, so lambda does
 * not scale a stem every species shares.
 *
 * lambda is estimated by maximum likelihood over [0, 1] with s2 profiled out, as `pgls.py` of
 * mitoage-pipelines does; the slopes are tested with s2 = RSS / (n - p) on n - p degrees of freedom, where p
 * counts the intercept. With lambda = 1 the slope test of one predictor is the contrast correlation's t test,
 * and with two predictors the first slope's test is the partial contrast correlation's.
 */
import { type CompiledTree, tTestTwoTailed } from "./stats";

/** Depth of every node of a compiled tree below its root (the root's own branch excluded). */
export function nodeDepths(t: CompiledTree): Float64Array {
  const depth = new Float64Array(t.children.length);
  // Post-order: the root is last and every parent comes after its children, so walk backwards.
  for (let i = t.children.length - 1; i >= 0; i--) {
    for (const k of t.children[i]!) depth[k] = depth[i]! + t.length[k]!;
  }
  depth[t.root] = 0;
  return depth;
}

/** Why a fit was not made. */
export type PglsRefusal = "too-few-species" | "singular" | "degenerate-tree";

export interface PglsFit {
  /** Species with every value known and a place in the tree. */
  n: number;
  lambda: number;
  /** Maximised log-likelihood (s2 at its maximum-likelihood value, RSS / n). */
  logLik: number;
  /** One per predictor, in the order given; the intercept is not reported. */
  coef: number[];
  se: number[];
  t: number[];
  p: number[];
  df: number;
}

interface Contrasts {
  /** Contrasts per column (column 0 is the response), each of length m. */
  c: Float64Array[];
  m: number;
  n: number;
  logDet: number;
}

/**
 * Standardised contrasts of every column on the tree transformed by lambda, over the species where all
 * columns are known. Polytomies are resolved by sequential pairing, which leaves V unchanged. Null when two
 * daughters both sit at distance zero, where V is singular (it cannot happen on a tree with tips of positive
 * depth and lambda < 1, and the caller reports it rather than averaging the two).
 */
function lambdaContrasts(t: CompiledTree, depth: Float64Array, lambda: number, cols: readonly ArrayLike<number>[]): Contrasts | null {
  const nNodes = t.children.length;
  const k = cols.length;
  const has = new Uint8Array(nNodes);
  const val = new Float64Array(nNodes * k);
  const extra = new Float64Array(nNodes);
  const out: number[][] = cols.map(() => []);
  // First pass: the species with every value, and their most recent common ancestor, which is the root of the
  // tree the model is fitted on (as when the tree is pruned to them). The first node in post-order holding all
  // of them is that ancestor.
  const count = new Int32Array(nNodes);
  let n = 0;
  for (let i = 0; i < nNodes; i++) {
    const kids = t.children[i]!;
    if (kids.length === 0) {
      const li = t.leafIndex[i]!;
      if (li < 0) continue;
      let ok = true;
      for (let j = 0; j < k; j++) {
        const v = cols[j]![li]!;
        if (!Number.isFinite(v)) { ok = false; break; }
        val[i * k + j] = v;
      }
      if (!ok) continue;
      has[i] = 1;
      count[i] = 1;
      n++;
      continue;
    }
    for (const c of kids) count[i] = count[i]! + count[c]!;
  }
  if (n === 0) return { c: cols.map(() => new Float64Array(0)), m: 0, n: 0, logDet: 0 };
  let mrca = -1;
  for (let i = 0; i < nNodes; i++) if (count[i] === n) { mrca = i; break; }
  const top = depth[mrca]!;
  let logDet = 0;
  const acc = new Float64Array(k);
  for (let i = 0; i <= mrca; i++) {
    const kids = t.children[i]!;
    const len = t.length[i]!;
    if (kids.length === 0) {
      if (!has[i]) continue;
      // A lone species (n = 1) is its own ancestor: its variance is its depth below itself, zero.
      extra[i] = i === mrca ? 0 : lambda * len + (1 - lambda) * (depth[i]! - top);
      continue;
    }
    let first = true;
    let av = 0;
    for (const c of kids) {
      if (!has[c]) continue;
      if (first) {
        for (let j = 0; j < k; j++) acc[j] = val[c * k + j]!;
        av = extra[c]!;
        first = false;
        continue;
      }
      const v2 = extra[c]!;
      const s = av + v2;
      if (!(s > 0)) return null;
      const sd = Math.sqrt(s);
      for (let j = 0; j < k; j++) {
        const b = val[c * k + j]!;
        out[j]!.push((acc[j]! - b) / sd);
        acc[j] = (acc[j]! * v2 + b * av) / s;
      }
      logDet += Math.log(s);
      av = (av * v2) / s;
    }
    if (first) continue;
    has[i] = 1;
    for (let j = 0; j < k; j++) val[i * k + j] = acc[j]!;
    extra[i] = av + lambda * len;
    if (i === mrca) {
      if (!(av > 0)) return null;
      logDet += Math.log(av);
    }
  }
  return { c: out.map((a) => Float64Array.from(a)), m: out[0]!.length, n, logDet };
}

/** Solve the symmetric system A x = b by Gaussian elimination with partial pivoting; null if singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const p = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < p; col++) {
    let piv = col;
    for (let r = col + 1; r < p; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    const scale = Math.max(...M.map((row) => Math.abs(row[col]!)), 1e-300);
    if (Math.abs(M[piv]![col]!) <= 1e-12 * scale) return null;
    [M[col], M[piv]] = [M[piv]!, M[col]!];
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / M[col]![col]!;
      for (let c = col; c <= p; c++) M[r]![c] = M[r]![c]! - f * M[col]![c]!;
    }
  }
  return M.map((row, i) => row[p]! / row[i]!);
}

interface AtLambda {
  logLik: number;
  coef: number[];
  /** Diagonal of (U'U)^-1, for the standard errors. */
  inv: number[];
  rss: number;
  n: number;
}

function fitAt(t: CompiledTree, depth: Float64Array, lambda: number, y: ArrayLike<number>, xs: readonly ArrayLike<number>[]): AtLambda | PglsRefusal {
  const con = lambdaContrasts(t, depth, lambda, [y, ...xs]);
  if (!con) return "degenerate-tree";
  const q = xs.length;
  if (con.n < q + 3) return "too-few-species";
  const U = con.c.slice(1);
  const u = con.c[0]!;
  const A: number[][] = U.map((a) => U.map((b) => { let s = 0; for (let i = 0; i < con.m; i++) s += a[i]! * b[i]!; return s; }));
  const rhs = U.map((a) => { let s = 0; for (let i = 0; i < con.m; i++) s += a[i]! * u[i]!; return s; });
  const coef = solve(A, rhs);
  if (!coef) return "singular";
  const inv: number[] = [];
  for (let j = 0; j < q; j++) {
    const e = new Array<number>(q).fill(0);
    e[j] = 1;
    const col = solve(A, e);
    if (!col) return "singular";
    inv.push(col[j]!);
  }
  let rss = 0;
  for (let i = 0; i < con.m; i++) {
    let r = u[i]!;
    for (let j = 0; j < q; j++) r -= coef[j]! * U[j]![i]!;
    rss += r * r;
  }
  if (!(rss > 0)) return "singular";
  const n = con.n;
  const logLik = -0.5 * n * (Math.log((2 * Math.PI * rss) / n) + 1) - 0.5 * con.logDet;
  return { logLik, coef, inv, rss, n };
}

function report(a: AtLambda, lambda: number): PglsFit {
  const q = a.coef.length;
  const df = a.n - (q + 1);
  const s2 = a.rss / df;
  const se = a.inv.map((v) => Math.sqrt(s2 * v));
  const tt = a.coef.map((b, j) => b / se[j]!);
  return { n: a.n, lambda, logLik: a.logLik, coef: a.coef, se, t: tt, p: tt.map((v) => tTestTwoTailed(v, df)), df };
}

/** The fit at a fixed lambda (lambda = 1 is Brownian motion on the tree as it is). */
export function pglsAt(t: CompiledTree, depth: Float64Array, lambda: number, y: ArrayLike<number>, xs: readonly ArrayLike<number>[]): PglsFit | PglsRefusal {
  const a = fitAt(t, depth, lambda, y, xs);
  return typeof a === "string" ? a : report(a, lambda);
}

const GRID = 20;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

/**
 * The fit at the maximum-likelihood lambda in [0, 1]: a grid of 21 values first, so that a second mode is not
 * missed, then golden-section search between the best grid value's neighbours, to 1e-6.
 */
export function pgls(t: CompiledTree, depth: Float64Array, y: ArrayLike<number>, xs: readonly ArrayLike<number>[]): PglsFit | PglsRefusal {
  const ll = new Float64Array(GRID + 1);
  let best = -1;
  for (let g = 0; g <= GRID; g++) {
    const a = fitAt(t, depth, g / GRID, y, xs);
    if (typeof a === "string") {
      if (a === "too-few-species") return a;
      ll[g] = -Infinity;
      continue;
    }
    ll[g] = a.logLik;
    if (best < 0 || a.logLik > ll[best]!) best = g;
  }
  if (best < 0) return pglsAt(t, depth, 1, y, xs);
  const f = (lam: number) => {
    const a = fitAt(t, depth, lam, y, xs);
    return typeof a === "string" ? -Infinity : a.logLik;
  };
  let lo = Math.max(0, (best - 1) / GRID);
  let hi = Math.min(1, (best + 1) / GRID);
  let c = hi - GOLDEN * (hi - lo);
  let d = lo + GOLDEN * (hi - lo);
  let fc = f(c), fd = f(d);
  while (hi - lo > 1e-6) {
    if (fc >= fd) { hi = d; d = c; fd = fc; c = hi - GOLDEN * (hi - lo); fc = f(c); }
    else { lo = c; c = d; fc = fd; d = lo + GOLDEN * (hi - lo); fd = f(d); }
  }
  // The interior optimum, unless an end of [0, 1] (a grid point) is higher.
  let lam = (lo + hi) / 2;
  if (ll[best]! > f(lam)) lam = best / GRID;
  return pglsAt(t, depth, lam, y, xs);
}
