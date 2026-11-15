import { describe, expect, test } from "bun:test";
import { nodeDepths, pgls, pglsAt, type PglsFit } from "../lib/pgls";
import { type CompiledTree, compileTree, partialContrastCorrelation, picContrasts, picFast } from "../lib/stats";
import { buildScopes, inDataset, log10OrNull } from "../steps/correlations";
import { getAllSpecies, getFeatureValueArrays, getPhylogeny } from "../../src/data";

// Real data: the committed build, its dated tree, the default dataset's scopes.
const species = getAllSpecies();
const { values } = getFeatureValueArrays();
const phylo = getPhylogeny()!;
const indexOf = new Map(species.map((s, i) => [s.id, i]));
const tree = compileTree(phylo.root, (leaf) => indexOf.get(leaf));
const depth = nodeDepths(tree);
const scopes = buildScopes(species, (s) => inDataset(s, "default"));
const lifespan = Float64Array.from(species.map((s) => log10OrNull(s.maxLongevityYears) ?? NaN));
const mass = Float64Array.from(species.map((s) => log10OrNull(s.traits.adultWeightG) ?? NaN));
const inTree = new Set<number>();
tree.leafIndex.forEach((li, node) => { if (li >= 0 && tree.children[node]!.length === 0) inTree.add(li); });

/** The feature on one scope's species, NaN elsewhere. */
function featureOn(scopeKey: string, featureKey: string): Float64Array {
  const scope = scopes.find((s) => s.key === scopeKey)!;
  const fx = values.get(featureKey)!;
  const x = new Float64Array(species.length).fill(NaN);
  for (const i of scope.members) {
    const v = fx[i];
    if (v !== null && v !== undefined) x[i] = v;
  }
  return x;
}

/**
 * The same model fitted the slow way, written independently of the library: the covariance matrix from the
 * tree (shared path below the species' common ancestor), lambda on its off-diagonal, Cholesky, whitened least
 * squares with an intercept.
 */
function dense(t: CompiledTree, lambda: number, y: ArrayLike<number>, xs: readonly ArrayLike<number>[]) {
  const parent = new Int32Array(t.children.length).fill(-1);
  t.children.forEach((kids, i) => kids.forEach((k) => (parent[k] = i)));
  const tips: number[] = [];
  t.leafIndex.forEach((li, node) => {
    if (li >= 0 && t.children[node]!.length === 0 && [y, ...xs].every((c) => Number.isFinite(c[li]!))) tips.push(node);
  });
  const path = (node: number) => { const p: number[] = []; for (let v = node; v >= 0; v = parent[v]!) p.push(v); return p; };
  const paths = tips.map(path);
  // The common ancestor of all of them: the deepest node on every path.
  const onAll = paths[0]!.filter((v) => paths.every((p) => p.includes(v)));
  const top = depth[onAll[0]!]!;
  const n = tips.length;
  const V: number[][] = [];
  for (let a = 0; a < n; a++) {
    V.push([]);
    const set = new Set(paths[a]);
    for (let b = 0; b < n; b++) {
      const lca = paths[b]!.find((v) => set.has(v))!;
      const shared = depth[lca]! - top;
      V[a]!.push(a === b ? shared : lambda * shared);
    }
  }
  const L: number[][] = V.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = V[i]![j]!;
      for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
      L[i]![j] = i === j ? Math.sqrt(s) : s / L[j]![j]!;
    }
  }
  const whiten = (v: number[]) => {
    const w = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) { let s = v[i]!; for (let k = 0; k < i; k++) s -= L[i]![k]! * w[k]!; w[i] = s / L[i]![i]!; }
    return w;
  };
  const li = tips.map((node) => t.leafIndex[node]!);
  const X = [li.map(() => 1), ...xs.map((c) => li.map((i) => c[i]!))].map(whiten);
  const yw = whiten(li.map((i) => y[i]!));
  const p = X.length;
  const A = X.map((a) => X.map((b) => a.reduce((s, v, i) => s + v * b[i]!, 0)));
  const rhs = X.map((a) => a.reduce((s, v, i) => s + v * yw[i]!, 0));
  // Invert A by Gauss-Jordan.
  const M = A.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    for (let k = 0; k < 2 * p; k++) M[c]![k] = M[c]![k]! / d;
    for (let r = 0; r < p; r++) if (r !== c) { const f = M[r]![c]!; for (let k = 0; k < 2 * p; k++) M[r]![k] = M[r]![k]! - f * M[c]![k]!; }
  }
  const inv = M.map((row) => row.slice(p));
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * rhs[j]!, 0));
  let rss = 0;
  for (let i = 0; i < n; i++) { let r = yw[i]!; for (let j = 0; j < p; j++) r -= beta[j]! * X[j]![i]!; rss += r * r; }
  let logDetHalf = 0;
  for (let i = 0; i < n; i++) logDetHalf += Math.log(L[i]![i]!);
  const logLik = -0.5 * n * (Math.log((2 * Math.PI * rss) / n) + 1) - logDetHalf;
  const s2 = rss / (n - p);
  return { n, logLik, coef: beta.slice(1), se: inv.slice(1).map((row, j) => Math.sqrt(s2 * row[j + 1]!)) };
}

const fit = (r: PglsFit | string): PglsFit => {
  if (typeof r === "string") throw new Error(`refused: ${r}`);
  return r;
};
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));

describe("PGLS with Pagel's lambda on the dated tree", () => {
  const scope = "order:Primates";
  const gc = featureOn(scope, "gc:total_mtDNA");
  const cys = featureOn(scope, "aa:total_pc:C");

  test("agrees with the dense fit at every lambda, with and without body mass", () => {
    for (const [y, xs] of [[gc, [lifespan]], [cys, [lifespan, mass]]] as const) {
      for (const lam of [0, 0.25, 0.7, 0.95, 1]) {
        const a = fit(pglsAt(tree, depth, lam, y, xs));
        const b = dense(tree, lam, y, xs);
        expect(a.n).toBe(b.n);
        expect(a.n).toBeGreaterThan(50);
        expect(rel(a.logLik, b.logLik)).toBeLessThan(1e-9);
        a.coef.forEach((c, j) => expect(rel(c, b.coef[j]!)).toBeLessThan(1e-8));
        a.se.forEach((s, j) => expect(rel(s, b.se[j]!)).toBeLessThan(1e-8));
      }
    }
  });

  test("lambda = 1 gives the table's contrast tests: the correlation, and the partial one on mass", () => {
    const one = fit(pglsAt(tree, depth, 1, gc, [lifespan]));
    const pic = picFast(tree, gc, lifespan)!;
    expect(rel(one.p[0]!, pic.p)).toBeLessThan(1e-9);
    expect(Math.sign(one.coef[0]!)).toBe(Math.sign(pic.r));
    expect(one.df).toBe(pic.contrasts - 1);

    const two = fit(pglsAt(tree, depth, 1, cys, [lifespan, mass]));
    const { cx, cy, cz } = picContrasts(tree, cys, lifespan, mass);
    const part = partialContrastCorrelation(cx, cy, cz)!;
    expect(rel(two.p[0]!, part.p)).toBeLessThan(1e-9);
    expect(two.df).toBe(part.contrasts - 2);
  });

  test("the estimated lambda maximises the likelihood over [0, 1]", () => {
    // GC balance of ND6 has an interior maximum (about 0.71 in mammals, 0.79 in Carnivora), between the points of
    // the coarse search; the others sit at or near 1. The grid here is twenty times finer than the coarse one.
    const cases = [
      [gc, [lifespan]],
      [cys, [lifespan, mass]],
      [featureOn("class:Mammalia", "gcSkew:ND6"), [lifespan]],
      [featureOn("order:Carnivora", "gcSkew:ND6"), [lifespan, mass]],
    ] as const;
    let interior = 0;
    for (const [y, xs] of cases) {
      const best = fit(pgls(tree, depth, y, xs));
      expect(best.lambda).toBeGreaterThanOrEqual(0);
      expect(best.lambda).toBeLessThanOrEqual(1);
      if (best.lambda > 0.01 && best.lambda < 0.99) interior++;
      for (let g = 0; g <= 1000; g++) {
        const other = fit(pglsAt(tree, depth, g / 1000, y, xs));
        expect(best.logLik).toBeGreaterThanOrEqual(other.logLik - 1e-9);
      }
    }
    expect(interior).toBeGreaterThanOrEqual(2);
  });

  test("edges: too few species, a constant predictor, missing values", () => {
    const few = new Float64Array(species.length).fill(NaN);
    // Only species with a place in the tree can enter a model on it.
    const members = scopes.find((s) => s.key === scope)!.members.filter((i) => inTree.has(i) && Number.isFinite(lifespan[i]!) && Number.isFinite(gc[i]!));
    for (const i of members.slice(0, 3)) few[i] = gc[i]!;
    expect(pgls(tree, depth, few, [lifespan])).toBe("too-few-species");

    const flat = Float64Array.from(lifespan, (v, i) => (Number.isFinite(gc[i]!) && Number.isFinite(v) ? 1 : NaN));
    expect(pglsAt(tree, depth, 0.5, gc, [flat])).toBe("singular");

    // A species whose mass is missing drops out of the model with mass and stays in the one without.
    const withMass = fit(pglsAt(tree, depth, 0.5, gc, [lifespan, mass]));
    const without = fit(pglsAt(tree, depth, 0.5, gc, [lifespan]));
    const both = members.filter((i) => Number.isFinite(mass[i]!)).length;
    expect(without.n).toBe(members.length);
    expect(withMass.n).toBe(both);
  });
});
