/** Build-time taxonomy helpers on top of the data API. Do not import from islands. */
import { getTaxa } from "~/data";
import type { Rank, Species, TaxonNode } from "~/data/schema";
import { taxonUrl } from "./urls";

let byKey: Map<string, TaxonNode> | null = null;

const index = (): Map<string, TaxonNode> => {
  if (!byKey) {
    byKey = new Map();
    for (const t of getTaxa()) byKey.set(`${t.rank}:${t.name}`, t);
  }
  return byKey;
};

export const findTaxon = (rank: Rank, name: string): TaxonNode | undefined => index().get(`${rank}:${name}`);

export interface Crumb {
  label: string;
  rank: Rank;
  /** Undefined when the taxon has no page (not in the tree). */
  href?: string;
}

export const BREADCRUMB_RANKS: readonly Exclude<Rank, "species">[] = [
  "phylum",
  "class",
  "order",
  "family",
  "genus",
];

/** Taxonomy chain of a species, from `from` rank down to genus. */
export const speciesCrumbs = (s: Species, from: Exclude<Rank, "species"> = "class"): Crumb[] => {
  const start = BREADCRUMB_RANKS.indexOf(from);
  return BREADCRUMB_RANKS.slice(Math.max(0, start)).flatMap((rank) => {
    const name = s.taxonomy[rank];
    if (!name) return [];
    const node = findTaxon(rank, name);
    const crumb: Crumb = { label: name, rank };
    if (node) crumb.href = taxonUrl(rank, node.slug);
    return [crumb];
  });
};

export const taxaOfRank = (rank: Rank): TaxonNode[] => getTaxa().filter((t) => t.rank === rank);
