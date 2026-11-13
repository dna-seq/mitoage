/**
 * Wire format of /tree/tree.json (built by src/pages/tree/tree.json.ts) and its decoder.
 * Safe for islands: no data-layer imports.
 *
 * The taxonomy is sent as flat, columnar arrays in depth-first pre-order with parent indices,
 * which is far smaller than nested objects. decodeTree() rebuilds a d3 hierarchy from it.
 */
import { stratify, type HierarchyNode } from "d3-hierarchy";
import type { Rank } from "~/data/schema";

export const RANKS: readonly Rank[] = ["kingdom", "phylum", "class", "order", "family", "genus", "species"];
/** Depth of the class rank (kingdom = 0). */
export const CLASS_DEPTH = 2;
export const SPECIES_DEPTH = 6;

export interface TreePayload {
  v: 1;
  /**
   * Age of the root in million years when the tree is dated and ultrametric (every species
   * ends at the present), otherwise null and only the rank layout is offered.
   */
  rootAge: number | null;
  /** Class names; `cls` holds indices into this list. */
  classes: string[];
  /** One entry per node, depth-first pre-order; node 0 is the root. */
  name: string[];
  slug: string[];
  /** Index into RANKS. */
  rank: number[];
  /** Index of the parent node, -1 for the root. */
  parent: number[];
  /** Node age in million years (0 for living species), null when unknown. */
  age: (number | null)[];
  /** Class index, -1 above class rank. */
  cls: number[];
  /** Species data, one entry per leaf, in pre-order. */
  leaf: {
    node: number[];
    common: string[];
    /** Maximum lifespan, years. */
    life: number[];
    /** Whole-genome GC percent. */
    gc: number[];
    /** mtDNA length, bp. */
    size: number[];
    /** Versioned RefSeq accession of the genome, e.g. "NC_012920.1". */
    refseq: string[];
  };
}

export interface SpeciesInfo {
  common: string;
  life: number;
  gc: number;
  size: number;
  /** Versioned RefSeq accession; "" when the payload has none for the species. */
  refseq: string;
}

export interface TaxonDatum {
  /** Pre-order index. */
  i: number;
  name: string;
  slug: string;
  rank: Rank;
  /** Parent index, -1 for the root. */
  p: number;
  age: number | null;
  /** Class name, null above class rank. */
  cls: string | null;
  /** Leaf position in pre-order (leaves only). */
  leafIndex: number;
  sp: SpeciesInfo | null;
}

export type TNode = HierarchyNode<TaxonDatum>;

export interface TreeModel {
  root: TNode;
  /** Every node by pre-order index. */
  nodes: TNode[];
  /** Leaves in pre-order. */
  leaves: TNode[];
  /** "rank:slug" -> node. */
  byKey: Map<string, TNode>;
  /** Root age when the tree is dated, else null. */
  rootAge: number | null;
  /** First and last leaf index below each node (pre-order), by node index. */
  leafRange: Int32Array;
}

export const nodeKey = (n: { data: { rank: Rank; slug: string } }): string => `${n.data.rank}:${n.data.slug}`;

/** "class:mammalia" -> ["class", "mammalia"] when the rank is valid. */
export const parseKey = (key: string | null | undefined): [Rank, string] | null => {
  if (!key) return null;
  const m = /^([a-z]+):([a-z0-9-]+)$/.exec(key.trim().toLowerCase());
  if (!m) return null;
  const rank = m[1] as Rank;
  return RANKS.includes(rank) ? [rank, m[2] ?? ""] : null;
};

export const decodeTree = (p: TreePayload): TreeModel => {
  const rows: TaxonDatum[] = p.name.map((name, i) => ({
    i,
    name,
    slug: p.slug[i] ?? "",
    rank: RANKS[p.rank[i] ?? 0] ?? "species",
    p: p.parent[i] ?? -1,
    age: p.age[i] ?? null,
    cls: (p.cls[i] ?? -1) >= 0 ? (p.classes[p.cls[i] ?? 0] ?? null) : null,
    leafIndex: -1,
    sp: null,
  }));
  p.leaf.node.forEach((ni, k) => {
    const row = rows[ni];
    if (!row) return;
    row.leafIndex = k;
    row.sp = {
      common: p.leaf.common[k] ?? "",
      life: p.leaf.life[k] ?? Number.NaN,
      gc: p.leaf.gc[k] ?? Number.NaN,
      size: p.leaf.size[k] ?? Number.NaN,
      // `refseq` is missing from a payload cached before the field existed.
      refseq: (p.leaf.refseq as string[] | undefined)?.[k] ?? "",
    };
  });
  const root = stratify<TaxonDatum>()
    .id((d) => String(d.i))
    .parentId((d) => (d.p < 0 ? null : String(d.p)))(rows);
  // stratify keeps input order for siblings, so pre-order is preserved; count() gives leaf counts.
  root.count();
  const nodes: TNode[] = new Array(rows.length);
  root.each((n) => {
    nodes[n.data.i] = n;
  });
  const leaves = root.leaves();
  const leafRange = new Int32Array(rows.length * 2);
  root.eachAfter((n) => {
    const i = n.data.i;
    if (!n.children) {
      leafRange[2 * i] = n.data.leafIndex;
      leafRange[2 * i + 1] = n.data.leafIndex;
    } else {
      const first = n.children[0];
      const last = n.children[n.children.length - 1];
      leafRange[2 * i] = first ? (leafRange[2 * first.data.i] ?? 0) : 0;
      leafRange[2 * i + 1] = last ? (leafRange[2 * last.data.i + 1] ?? 0) : 0;
    }
  });
  const byKey = new Map<string, TNode>();
  for (const n of nodes) byKey.set(nodeKey(n), n);
  return { root, nodes, leaves, byKey, rootAge: p.rootAge, leafRange };
};
