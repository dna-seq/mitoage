/** Rank labels and short names for taxa. Safe for islands. */
import type { Rank } from "~/data/schema";

export const RANK_LABEL: Record<Rank, string> = {
  kingdom: "Kingdom",
  phylum: "Phylum",
  class: "Class",
  order: "Order",
  family: "Family",
  genus: "Genus",
  species: "Species",
};

const PLURAL: Record<Rank, string> = {
  kingdom: "kingdoms",
  phylum: "phyla",
  class: "classes",
  order: "orders",
  family: "families",
  genus: "genera",
  species: "species",
};

/** "3 orders", "1 genus", "12 species". */
export const rankCount = (n: number, rank: Rank): string =>
  `${n.toLocaleString("en-US")} ${n === 1 ? rank : PLURAL[rank]}`;

export const rankPlural = (rank: Rank): string => PLURAL[rank];

/** The rank one level below, e.g. "order" -> "family". */
export const childRank = (rank: Rank): Rank => {
  const order: Rank[] = ["kingdom", "phylum", "class", "order", "family", "genus", "species"];
  return order[Math.min(order.length - 1, order.indexOf(rank) + 1)] ?? "species";
};

/** Genus and species names are italic by convention. */
export const isItalicRank = (rank: Rank): boolean => rank === "genus" || rank === "species";

/** "Homo sapiens" -> "H. sapiens". */
export const abbrevName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]?.charAt(0) ?? ""}. ${parts.slice(1).join(" ")}`;
};
