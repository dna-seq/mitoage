/**
 * Build-time taxonomy helpers for the tree and taxon pages: the compact client payload,
 * node ages from the dated tree, ancestors and clade statistics. Do not import from islands.
 */
import { getSpeciesById, getTaxonomyTree } from "~/data";
import type { Rank, Species, TaxonNode } from "~/data/schema";
import { RANKS, type TreePayload } from "./types";

/** Round to `d` decimals. */
const round = (v: number, d: number): number => {
  const k = 10 ** d;
  return Math.round(v * k) / k;
};

// ---------------------------------------------------------------- dated tree check

export interface DatingReport {
  /** True when root-to-tip sums agree within `tolerance` for every species with complete branch lengths. */
  dated: boolean;
  /** Age of the root (the largest root-to-tip sum), Mya. */
  rootAge: number;
  /** Largest difference between a complete root-to-tip sum and the root age, Mya. */
  maxDeviation: number;
  /** Nodes below the root without a branch length, "rank:name". */
  missing: string[];
  /** Species whose path from the root has a missing branch length. */
  incompleteTips: number;
  tips: number;
}

const TOLERANCE_MYA = 1;

export const checkDating = (root: TaxonNode): DatingReport => {
  const missing: string[] = [];
  const sums: number[] = [];
  let incompleteTips = 0;
  let tips = 0;
  const walk = (n: TaxonNode, depth: number, complete: boolean, isRoot: boolean) => {
    const bl = n.branchLengthMya;
    const has = typeof bl === "number" && Number.isFinite(bl) && bl >= 0;
    if (!isRoot && !has) missing.push(`${n.rank}:${n.name}`);
    const d = depth + (has ? (bl as number) : 0);
    const ok = complete && (isRoot || has);
    if (!n.children.length) {
      tips++;
      if (ok) sums.push(d);
      else incompleteTips++;
    }
    n.children.forEach((c) => walk(c, d, ok, false));
  };
  walk(root, 0, true, true);
  const rootAge = sums.length ? Math.max(...sums) : 0;
  const maxDeviation = sums.length ? rootAge - Math.min(...sums) : Number.POSITIVE_INFINITY;
  return {
    dated: sums.length > tips * 0.9 && rootAge > 0 && maxDeviation <= TOLERANCE_MYA,
    rootAge,
    maxDeviation,
    missing,
    incompleteTips,
    tips,
  };
};

/**
 * Node ages (Mya) from branch lengths: age = root age − sum of branch lengths from the root.
 * A missing branch length counts as 0 for an internal node (it sits at its parent's age);
 * a species always ends at the present. Ages never increase from parent to child.
 */
export const nodeAges = (root: TaxonNode, rootAge: number): Map<TaxonNode, number> => {
  const ages = new Map<TaxonNode, number>();
  const walk = (n: TaxonNode, depth: number, parentAge: number) => {
    const bl = n.branchLengthMya;
    const d = depth + (typeof bl === "number" && Number.isFinite(bl) && bl > 0 ? bl : 0);
    const age = n.children.length ? Math.min(parentAge, Math.max(0, rootAge - d)) : 0;
    ages.set(n, age);
    n.children.forEach((c) => walk(c, d, age));
  };
  walk(root, 0, rootAge);
  ages.set(root, rootAge);
  return ages;
};

let datingCache: DatingReport | null = null;
export const datingReport = (): DatingReport => (datingCache ??= checkDating(getTaxonomyTree()));

// ---------------------------------------------------------------- client payload

export const buildTreePayload = (): TreePayload => {
  const root = getTaxonomyTree();
  const report = datingReport();
  const ages = report.dated ? nodeAges(root, report.rootAge) : null;
  const classes: string[] = [];
  const classIndex = new Map<string, number>();
  const out: TreePayload = {
    v: 1,
    rootAge: report.dated ? round(report.rootAge, 2) : null,
    classes,
    name: [],
    slug: [],
    rank: [],
    parent: [],
    age: [],
    cls: [],
    leaf: { node: [], common: [], life: [], gc: [], size: [], refseq: [] },
  };
  const walk = (n: TaxonNode, parent: number, cls: number) => {
    const i = out.name.length;
    let c = cls;
    if (n.rank === "class") {
      if (!classIndex.has(n.name)) {
        classIndex.set(n.name, classes.length);
        classes.push(n.name);
      }
      c = classIndex.get(n.name) ?? -1;
    }
    const rankIdx = RANKS.indexOf(n.rank);
    if (rankIdx < 0) throw new Error(`Unknown rank ${n.rank}`);
    out.name.push(n.name);
    out.slug.push(n.slug);
    out.rank.push(rankIdx);
    out.parent.push(parent);
    out.age.push(ages ? round(ages.get(n) ?? 0, 2) : null);
    out.cls.push(c);
    if (n.speciesId !== undefined) {
      const s = getSpeciesById(n.speciesId);
      out.leaf.node.push(i);
      out.leaf.common.push(s?.commonName.trim() ?? "");
      out.leaf.life.push(s ? round(s.maxLongevityYears, 2) : Number.NaN);
      out.leaf.gc.push(s ? round(s.gcPercent, 2) : Number.NaN);
      out.leaf.size.push(s?.mtdnaSizeBp ?? Number.NaN);
      out.leaf.refseq.push(s?.refseq ?? "");
    }
    n.children.forEach((ch) => walk(ch, i, c));
  };
  walk(root, -1, -1);
  return out;
};

// ---------------------------------------------------------------- ancestors and clade stats

interface Indexed {
  parent: Map<TaxonNode, TaxonNode>;
  byKey: Map<string, TaxonNode>;
}
let indexCache: Indexed | null = null;
const indexed = (): Indexed => {
  if (indexCache) return indexCache;
  const parent = new Map<TaxonNode, TaxonNode>();
  const byKey = new Map<string, TaxonNode>();
  const walk = (n: TaxonNode) => {
    byKey.set(`${n.rank}:${n.slug}`, n);
    for (const c of n.children) {
      parent.set(c, n);
      walk(c);
    }
  };
  walk(getTaxonomyTree());
  return (indexCache = { parent, byKey });
};

export const taxonNode = (rank: Rank, slug: string): TaxonNode | undefined => indexed().byKey.get(`${rank}:${slug}`);

/** Ancestors of a node from the root down, excluding the node itself. */
export const ancestorsOf = (node: TaxonNode): TaxonNode[] => {
  const { parent } = indexed();
  const out: TaxonNode[] = [];
  let p = parent.get(node);
  while (p) {
    out.unshift(p);
    p = parent.get(p);
  }
  return out;
};

export const parentOf = (node: TaxonNode): TaxonNode | undefined => indexed().parent.get(node);

/** Node age in Mya when the tree is dated. */
let agesCache: Map<TaxonNode, number> | null = null;
export const ageOf = (node: TaxonNode): number | null => {
  const r = datingReport();
  if (!r.dated) return null;
  agesCache ??= nodeAges(getTaxonomyTree(), r.rootAge);
  return agesCache.get(node) ?? null;
};

export const median = (vals: number[]): number => {
  const v = vals.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return Number.NaN;
  const m = v.length >> 1;
  return v.length % 2 ? (v[m] ?? Number.NaN) : ((v[m - 1] ?? 0) + (v[m] ?? 0)) / 2;
};

export interface CladeStats {
  count: number;
  longest: Species | undefined;
  shortest: Species | undefined;
  medianGc: number;
  minGc: number;
  maxGc: number;
  medianSize: number;
  medianLifespan: number;
}

export const cladeStats = (species: Species[]): CladeStats => {
  const byLife = [...species].sort((a, b) => b.maxLongevityYears - a.maxLongevityYears);
  const gcs = species.map((s) => s.gcPercent).filter(Number.isFinite);
  return {
    count: species.length,
    longest: byLife[0],
    shortest: byLife[byLife.length - 1],
    medianGc: median(gcs),
    minGc: gcs.length ? Math.min(...gcs) : Number.NaN,
    maxGc: gcs.length ? Math.max(...gcs) : Number.NaN,
    medianSize: median(species.map((s) => s.mtdnaSizeBp)),
    medianLifespan: median(species.map((s) => s.maxLongevityYears)),
  };
};
