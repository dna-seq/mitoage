/**
 * Calibration of the phylogenetically independent contrasts (PIC) test behind the correlation table's
 * pic_r and pic_p_value (docs/PIC_CALIBRATION.md). Heavy: run on the cluster through
 * pipeline/pic-calibration.sbatch, one Slurm array task per scope.
 *
 *   bun run pipeline/pic-calibration.ts scopes                       # list the scopes, one per line
 *   bun run pipeline/pic-calibration.ts calibrate <scope> <out.tsv>  # one scope's lifespan tests
 *   bun run pipeline/pic-calibration.ts export <dir> <scope> <feature>...   # inputs of the ape::pic check
 *
 * For each lifespan test (dataset "default", trait maxLongevityYears) `calibrate` reports, besides the
 * published r and p:
 *   - bm_reject: the share of replicates with p < 0.05 when log10 lifespan is replaced by a Brownian
 *     motion simulated on the same dated tree (the feature stays real). Conditional on the feature's
 *     contrasts, the lifespan contrasts are then independent normals of equal variance, so a correct
 *     implementation rejects 5% whatever the feature looks like: a check of the code, not of the model.
 *   - perm_reject: the same with log10 lifespan shuffled across the scope's species (no phylogenetic
 *     structure at all), the null docs/manuscript/NOTES.md Q5 asked for.
 *   - signflip_p: a p value that does not assume normal contrasts of equal variance: the signs of the
 *     lifespan contrasts are flipped at random, which keeps every contrast's size and so any node where
 *     both traits change a lot.
 *   - mass_r, mass_p: the contrast correlation with log10 adult body mass partialled out (regression
 *     through the origin on the contrasts of all three, df = m - 2), on the species with a mass.
 * The null replicates call the library's picFast, the code the site build runs.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { type CompiledTree, type PhyloNode, picFast, tTestTwoTailed } from "./lib/stats";
import { computeCorrelations, log10OrNull } from "./steps/correlations";
import { getAllSpecies, getFeatureDefs, getFeatureValueArrays, getPhylogeny } from "../src/data";
import { compileTree } from "./lib/stats";

const REPS_NULL = Number(process.env.PIC_REPS_NULL ?? 1000);
const REPS_FLIP = Number(process.env.PIC_REPS_FLIP ?? 9999);
const SEED = Number(process.env.PIC_SEED ?? 20261115);

// ---------------------------------------------------------------- deterministic random numbers

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// ---------------------------------------------------------------- contrasts with their nodes

export interface Contrast {
  /** The species ids under the node, as count:sum:min:max (unique in practice, cheap to compare). */
  key: string;
  cx: number;
  cy: number;
  cz: number;
  /** The variance the contrast was standardised by (sum of the two daughters' corrected lengths). */
  v: number;
}

/**
 * The contrasts picFast computes, kept one by one with a third trait z (NaN when a test does not use
 * one) and the node each belongs to. Same recursion as picFast; checked against it on every test.
 */
export function contrasts(t: CompiledTree, ids: ArrayLike<number>, x: ArrayLike<number>, y: ArrayLike<number>, z?: ArrayLike<number>): Contrast[] {
  const n = t.children.length;
  const has = new Uint8Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const vz = new Float64Array(n);
  const extra = new Float64Array(n);
  const cnt = new Float64Array(n);
  const sum = new Float64Array(n);
  const mn = new Float64Array(n);
  const mx = new Float64Array(n);
  const out: Contrast[] = [];
  for (let i = 0; i < n; i++) {
    const kids = t.children[i]!;
    if (kids.length === 0) {
      const li = t.leafIndex[i]!;
      if (li < 0) continue;
      const a = x[li]!;
      const b = y[li]!;
      const c = z ? z[li]! : 0;
      if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) continue;
      has[i] = 1;
      vx[i] = a;
      vy[i] = b;
      vz[i] = c;
      extra[i] = t.length[i]!;
      cnt[i] = 1;
      sum[i] = mn[i] = mx[i] = ids[li]!;
      continue;
    }
    let first = true;
    let ax = 0, ay = 0, az = 0, av = 0, ac = 0, as = 0, amn = 0, amx = 0;
    for (const k of kids) {
      if (!has[k]) continue;
      if (first) {
        ax = vx[k]!; ay = vy[k]!; az = vz[k]!; av = extra[k]!;
        ac = cnt[k]!; as = sum[k]!; amn = mn[k]!; amx = mx[k]!;
        first = false;
        continue;
      }
      ac += cnt[k]!; as += sum[k]!; amn = Math.min(amn, mn[k]!); amx = Math.max(amx, mx[k]!);
      const v2 = extra[k]!;
      const s = av + v2;
      if (s <= 0) {
        ax = (ax + vx[k]!) / 2; ay = (ay + vy[k]!) / 2; az = (az + vz[k]!) / 2; av = 0;
        continue;
      }
      const sd = Math.sqrt(s);
      out.push({ key: `${ac}:${as}:${amn}:${amx}`, cx: (ax - vx[k]!) / sd, cy: (ay - vy[k]!) / sd, cz: (az - vz[k]!) / sd, v: s });
      ax = (ax * v2 + vx[k]! * av) / s;
      ay = (ay * v2 + vy[k]! * av) / s;
      az = (az * v2 + vz[k]! * av) / s;
      av = (av * v2) / s;
    }
    if (first) continue;
    has[i] = 1;
    vx[i] = ax; vy[i] = ay; vz[i] = az;
    extra[i] = av + t.length[i]!;
    cnt[i] = ac; sum[i] = as; mn[i] = amn; mx[i] = amx;
  }
  return out;
}

const throughOrigin = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) {
    sab += a[i]! * b[i]!;
    saa += a[i]! * a[i]!;
    sbb += b[i]! * b[i]!;
  }
  return sab / Math.sqrt(saa * sbb);
};
const rP = (r: number, df: number) => (Math.abs(r) >= 1 ? 0 : tTestTwoTailed(r * Math.sqrt(df / (1 - r * r)), df));

/** Two-sided sign-flip p value of the through-origin correlation of a and b (flips b's signs). */
function signFlipP(a: Float64Array, b: Float64Array, reps: number, rand: () => number): number {
  const m = a.length;
  const prod = new Float64Array(m);
  let obs = 0;
  for (let i = 0; i < m; i++) {
    prod[i] = a[i]! * b[i]!;
    obs += prod[i]!;
  }
  const thr = Math.abs(obs) * (1 - 1e-12);
  let hits = 0;
  for (let r = 0; r < reps; r++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += rand() < 0.5 ? prod[i]! : -prod[i]!;
    if (Math.abs(s) >= thr) hits++;
  }
  return (hits + 1) / (reps + 1);
}

// ---------------------------------------------------------------- the build's data

function load() {
  const species = getAllSpecies();
  const { values } = getFeatureValueArrays();
  const phylo = getPhylogeny();
  if (!phylo) throw new Error("the build has no dated tree (src/data/generated/phylogeny.json): contrasts cannot be computed");
  const indexOf = new Map(species.map((s, i) => [s.id, i]));
  const tree = compileTree(phylo.root, (leaf) => indexOf.get(leaf));
  const { rows, scopes } = computeCorrelations(species, getFeatureDefs(), values, tree, "default");
  const lifespan = Float64Array.from(species.map((s) => log10OrNull(s.maxLongevityYears) ?? NaN));
  const mass = Float64Array.from(species.map((s) => log10OrNull(s.traits.adultWeightG) ?? NaN));
  const ids = Float64Array.from(species.map((s) => s.id));
  const lifespanRows = rows.filter((r) => r.trait === "maxLongevityYears");
  return { species, values, phylo, tree, scopes, lifespanRows, lifespan, mass, ids };
}

function parents(t: CompiledTree): Int32Array {
  const p = new Int32Array(t.children.length).fill(-1);
  t.children.forEach((kids, i) => kids.forEach((k) => (p[k] = i)));
  return p;
}

/** log10 lifespan replaced by Brownian motion (rate 1, root 0) on the tree, for the given species only. */
function simulateBM(t: CompiledTree, parent: Int32Array, nSpecies: number, members: Uint8Array, rand: () => number): Float64Array {
  const n = t.children.length;
  const val = new Float64Array(n);
  const out = new Float64Array(nSpecies).fill(NaN);
  for (let i = n - 1; i >= 0; i--) {
    const p = parent[i]!;
    val[i] = (p < 0 ? 0 : val[p]!) + Math.sqrt(Math.max(0, t.length[i]!)) * normal(rand);
    const li = t.leafIndex[i]!;
    if (t.children[i]!.length === 0 && li >= 0 && members[li]) out[li] = val[i]!;
  }
  return out;
}

// ---------------------------------------------------------------- commands

const fmt = (v: number) => (Number.isFinite(v) ? String(+v.toPrecision(8)) : "");

function calibrate(scopeKey: string, outPath: string) {
  const d = load();
  const scope = d.scopes.find((s) => s.key === scopeKey);
  if (!scope) throw new Error(`no scope ${scopeKey}; \`scopes\` lists them`);
  const nSpecies = d.species.length;
  const parent = parents(d.tree);
  const members = new Uint8Array(nSpecies);
  for (const i of scope.members) members[i] = 1;
  const rows = d.lifespanRows.filter((r) => r.scope === scopeKey).sort((a, b) => (a.featureKey < b.featureKey ? -1 : a.featureKey > b.featureKey ? 1 : 0));

  // Null lifespans shared by every feature of the scope.
  const rand = mulberry32(SEED ^ hashString(scopeKey));
  const bm: Float64Array[] = [];
  const perm: Float64Array[] = [];
  const withLifespan = scope.members.filter((i) => !Number.isNaN(d.lifespan[i]!));
  for (let r = 0; r < REPS_NULL; r++) {
    bm.push(simulateBM(d.tree, parent, nSpecies, members, rand));
    const shuffled = withLifespan.map((i) => d.lifespan[i]!);
    for (let k = shuffled.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [shuffled[k], shuffled[j]] = [shuffled[j]!, shuffled[k]!];
    }
    const p = new Float64Array(nSpecies).fill(NaN);
    withLifespan.forEach((i, k) => (p[i] = shuffled[k]!));
    perm.push(p);
  }

  const head = ["scope", "feature", "n", "m", "pearson_r", "p_value", "q_value", "pic_r", "pic_p_value", "pic_r_recomputed", "pic_p_recomputed", "signflip_p", "bm_reject", "perm_reject", "mass_n", "mass_m", "mass_r", "mass_p", "lifespan_abs_contrast_vs_sd_r", "max_share_of_cross_product"];
  const lines = [head.join("\t")];
  let mismatches = 0;
  for (const row of rows) {
    const fx = d.values.get(row.featureKey)!;
    const x = new Float64Array(nSpecies).fill(NaN);
    const y = new Float64Array(nSpecies).fill(NaN);
    for (const i of scope.members) {
      const v = fx[i];
      if (v === null || v === undefined || Number.isNaN(d.lifespan[i]!)) continue;
      x[i] = v;
      y[i] = d.lifespan[i]!;
    }
    const lib = picFast(d.tree, x, y);
    const cs = contrasts(d.tree, d.ids, x, y);
    const a = Float64Array.from(cs.map((c) => c.cx));
    const b = Float64Array.from(cs.map((c) => c.cy));
    const r = cs.length >= 3 ? throughOrigin(a, b) : NaN;
    const p = rP(r, cs.length - 1);
    if (lib && (Math.abs(lib.r - r) > 1e-9 || lib.contrasts !== cs.length)) mismatches++;
    if (row.picR !== null && Math.abs(row.picR - r) > 1e-9) mismatches++;

    let bmHits = 0, permHits = 0, nullRuns = 0;
    for (let k = 0; k < REPS_NULL; k++) {
      const rb = picFast(d.tree, x, bm[k]!);
      const rp = picFast(d.tree, x, perm[k]!);
      if (!rb || !rp) continue;
      nullRuns++;
      if (rb.p < 0.05) bmHits++;
      if (rp.p < 0.05) permHits++;
    }

    const flip = cs.length >= 3 ? signFlipP(a, b, REPS_FLIP, rand) : NaN;

    // Mass partialled out, on the species with all three values.
    const csm = contrasts(d.tree, d.ids, x, y, d.mass);
    let massR = NaN, massP = NaN;
    if (csm.length >= 4) {
      const ax = Float64Array.from(csm.map((c) => c.cx));
      const ay = Float64Array.from(csm.map((c) => c.cy));
      const az = Float64Array.from(csm.map((c) => c.cz));
      const rxy = throughOrigin(ax, ay), rxz = throughOrigin(ax, az), ryz = throughOrigin(ay, az);
      massR = (rxy - rxz * ryz) / Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz));
      massP = rP(massR, csm.length - 2);
    }
    let massN = 0;
    for (const i of scope.members) if (!Number.isNaN(x[i]!) && !Number.isNaN(d.mass[i]!)) massN++;

    // Garland et al. (1992): |standardised contrast| against its standard deviation, for lifespan.
    const absC = cs.map((c) => Math.abs(c.cy));
    const sds = cs.map((c) => Math.sqrt(c.v));
    const garland = cs.length >= 3 ? pearsonPlain(absC, sds) : NaN;
    // How much of the cross-product one contrast carries.
    let tot = 0, big = 0;
    for (let i = 0; i < a.length; i++) {
      const v = Math.abs(a[i]! * b[i]!);
      tot += v;
      if (v > big) big = v;
    }
    lines.push([scopeKey, row.featureKey, row.n, cs.length, fmt(row.pearsonR), fmt(row.pValue), fmt(row.qValue), fmt(row.picR ?? NaN), fmt(row.picPValue ?? NaN), fmt(r), fmt(p), fmt(flip), fmt(nullRuns ? bmHits / nullRuns : NaN), fmt(nullRuns ? permHits / nullRuns : NaN), massN, csm.length, fmt(massR), fmt(massP), fmt(garland), fmt(tot ? big / tot : NaN)].join("\t"));
  }
  writeFileSync(outPath, `${lines.join("\n")}\n`);
  console.log(`${scopeKey}: ${rows.length} lifespan tests, ${REPS_NULL} null replicates, ${REPS_FLIP} sign flips; contrasts differing from picFast or the table: ${mismatches}`);
  if (mismatches) process.exitCode = 1;
}

function pearsonPlain(x: number[], y: number[]) {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i]! - mx) * (y[i]! - my);
    sxx += (x[i]! - mx) ** 2;
    syy += (y[i]! - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

function newick(node: PhyloNode): string {
  const len = `:${node.length}`;
  if (node.leaf !== undefined) return `s${node.leaf}${len}`;
  return `(${node.children.map(newick).join(",")})${len}`;
}

function exportInputs(dir: string, scopeKey: string, features: string[]) {
  const d = load();
  const scope = d.scopes.find((s) => s.key === scopeKey);
  if (!scope) throw new Error(`no scope ${scopeKey}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "tree.nwk"), `${newick(d.phylo.root)};\n`);
  const nSpecies = d.species.length;
  const tips = [["feature", "species_id", "x", "y"].join("\t")];
  const ours = [["feature", "key", "cx", "cy", "v"].join("\t")];
  const tests = [["feature", "n", "m", "pic_r", "pic_p_value"].join("\t")];
  for (const f of features) {
    const fx = d.values.get(f);
    if (!fx) throw new Error(`no feature ${f}`);
    const x = new Float64Array(nSpecies).fill(NaN);
    const y = new Float64Array(nSpecies).fill(NaN);
    for (const i of scope.members) {
      const v = fx[i];
      if (v === null || v === undefined || Number.isNaN(d.lifespan[i]!)) continue;
      x[i] = v;
      y[i] = d.lifespan[i]!;
      tips.push([f, d.ids[i]!, v, d.lifespan[i]!].join("\t"));
    }
    for (const c of contrasts(d.tree, d.ids, x, y)) ours.push([f, c.key, c.cx, c.cy, c.v].join("\t"));
    const row = d.lifespanRows.find((r) => r.scope === scopeKey && r.featureKey === f);
    tests.push([f, row?.n ?? "", picFast(d.tree, x, y)?.contrasts ?? "", row?.picR ?? "", row?.picPValue ?? ""].join("\t"));
  }
  writeFileSync(join(dir, "tips.tsv"), `${tips.join("\n")}\n`);
  writeFileSync(join(dir, "contrasts_ours.tsv"), `${ours.join("\n")}\n`);
  writeFileSync(join(dir, "tests_ours.tsv"), `${tests.join("\n")}\n`);
  console.log(`wrote ${dir}: tree, ${features.length} features of ${scopeKey}`);
}

if (import.meta.main) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "scopes") {
    const d = load();
    const counts = new Map<string, number>();
    for (const r of d.lifespanRows) counts.set(r.scope, (counts.get(r.scope) ?? 0) + 1);
    for (const s of d.scopes) if (counts.get(s.key)) console.log(s.key);
  } else if (cmd === "calibrate" && args.length === 2) calibrate(args[0]!, args[1]!);
  else if (cmd === "export" && args.length >= 3) exportInputs(args[0]!, args[1]!, args.slice(2));
  else {
    console.error("usage: bun run pipeline/pic-calibration.ts scopes | calibrate <scope> <out.tsv> | export <dir> <scope> <feature>...");
    process.exitCode = 2;
  }
}
