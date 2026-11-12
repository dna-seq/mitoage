/** Taxonomy tree (kingdom -> species) with unique slugs and optional dated branch lengths. */
import type { Rank, Species, TaxonNode } from "../../src/data/schema";

export const RANKS: Exclude<Rank, "species">[] = ["kingdom", "phylum", "class", "order", "family", "genus"];

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Assign unique slugs from scientific names; a clash gets the RefSeq accession appended. */
export function uniqueSpeciesSlugs(items: { id: number; scientificName: string; refseq: string }[]): Map<number, string> {
  const out = new Map<number, string>();
  const used = new Set<string>();
  const sorted = [...items].sort((a, b) => a.id - b.id);
  for (const it of sorted) {
    let slug = slugify(it.scientificName);
    if (used.has(slug)) slug = `${slug}-${slugify(it.refseq)}`;
    used.add(slug);
    out.set(it.id, slug);
  }
  return out;
}

/**
 * Build the nested taxonomy. Species leaves are sorted by scientific name; taxa by name.
 * `ageOf(speciesIds)` may return the crown age (Mya) of a set of species from a dated tree.
 */
export function buildTaxonomyTree(species: Species[], ageOf?: (ids: number[]) => number | null): TaxonNode {
  interface Tmp {
    name: string;
    rank: Rank;
    children: Map<string, Tmp>;
    species: Species[];
  }
  const root: Tmp = { name: "", rank: "kingdom", children: new Map(), species: [] };
  for (const s of species) {
    let cur = root;
    for (const rank of RANKS) {
      const name = s.taxonomy[rank] || `Unknown ${rank}`;
      let next = cur.children.get(name);
      if (!next) {
        next = { name, rank, children: new Map(), species: [] };
        cur.children.set(name, next);
      }
      cur = next;
    }
    cur.species.push(s);
  }
  const usedSlugs = new Map<Rank, Set<string>>();
  const convert = (t: Tmp, parentSlug: string): TaxonNode => {
    const used = usedSlugs.get(t.rank) ?? new Set<string>();
    usedSlugs.set(t.rank, used);
    let slug = slugify(t.name);
    if (used.has(slug)) slug = `${slug}-${parentSlug}`;
    used.add(slug);
    const children: TaxonNode[] = [];
    for (const c of [...t.children.values()].sort((a, b) => a.name.localeCompare(b.name))) children.push(convert(c, slug));
    for (const s of [...t.species].sort((a, b) => a.scientificName.localeCompare(b.scientificName))) {
      children.push({ name: s.scientificName, rank: "species", slug: s.slug, speciesCount: 1, children: [], speciesId: s.id });
    }
    return {
      name: t.name,
      rank: t.rank,
      slug,
      speciesCount: children.reduce((n, c) => n + c.speciesCount, 0),
      children,
    };
  };
  const kingdoms = [...root.children.values()];
  if (kingdoms.length !== 1) throw new Error(`Expected a single kingdom, got ${kingdoms.map((k) => k.name).join(", ")}`);
  const tree = convert(kingdoms[0]!, "");
  if (ageOf) assignBranchLengths(tree, ageOf);
  return tree;
}

function speciesIdsUnder(n: TaxonNode): number[] {
  if (n.speciesId !== undefined) return [n.speciesId];
  return n.children.flatMap(speciesIdsUnder);
}

/** branchLengthMya = age(parent) - age(node); species leaves have age 0. Null when undated. */
function assignBranchLengths(root: TaxonNode, ageOf: (ids: number[]) => number | null): void {
  const age = (n: TaxonNode): number | null => {
    if (n.speciesId === undefined) return ageOf(speciesIdsUnder(n));
    return ageOf([n.speciesId]) === null ? null : 0;
  };
  const walk = (n: TaxonNode, nodeAge: number | null) => {
    for (const c of n.children) {
      const ca = age(c);
      c.branchLengthMya = nodeAge !== null && ca !== null ? Math.max(0, Math.round((nodeAge - ca) * 1000) / 1000) : null;
      walk(c, ca);
    }
  };
  root.branchLengthMya = null;
  walk(root, age(root));
}

export function flattenTaxa(root: TaxonNode): TaxonNode[] {
  const out: TaxonNode[] = [];
  const walk = (n: TaxonNode) => {
    if (n.rank === "species") return;
    out.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}
