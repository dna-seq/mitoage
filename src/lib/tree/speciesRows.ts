/**
 * Rows of a clade's species table (CladeSpeciesTable), from either of its two sources: the species
 * records at build time, for the rows a taxon page carries inline, and the leaves of the tree
 * payload, for the rows the island loads later. Both give a species the same name, link and RefSeq
 * accession, which is what the table's FASTA download asks NCBI for. They differ in one cell: a
 * species the data gives no order or family has an empty group here and, from the tree, the name
 * of the placeholder taxon it hangs under ("Unknown order"). Safe for islands.
 */
import type { Row } from "~/components/ui/DataTable";
import type { Rank, Species } from "~/data/schema";
import { classLabel } from "~/lib/classes";
import { speciesUrl } from "~/lib/urls";
import type { TNode } from "./types";

/** Row key holding the versioned RefSeq accession. */
export const REFSEQ_KEY = "refseq";

/** Group label of a species at a rank: the friendly name for classes, else the taxon name. */
export const groupLabel = (rank: Rank, name: string): string => (rank === "class" ? classLabel(name) : name);

/** The row of a species record; `groupRank` adds the name of its taxon at that rank. */
export function speciesRow(s: Species, groupRank?: Rank): Row {
  const row: Row = {
    name: s.scientificName,
    common: s.commonName,
    href: speciesUrl(s.slug),
    life: s.maxLongevityYears,
    size: s.mtdnaSizeBp,
    gc: s.gcPercent,
    [REFSEQ_KEY]: s.refseq,
  };
  if (groupRank) row["group"] = groupLabel(groupRank, s.taxonomy[groupRank as keyof Species["taxonomy"]]);
  return row;
}

/** The row of a species leaf of the decoded tree. */
export function leafRow(leaf: TNode, groupRank?: Rank): Row {
  const sp = leaf.data.sp;
  const row: Row = {
    name: leaf.data.name,
    common: sp?.common ?? "",
    href: speciesUrl(leaf.data.slug),
    life: sp?.life ?? null,
    size: sp?.size ?? null,
    gc: sp?.gc ?? null,
    [REFSEQ_KEY]: sp?.refseq ?? "",
  };
  if (groupRank) {
    const g = leaf.ancestors().find((a) => a.data.rank === groupRank);
    row["group"] = g ? groupLabel(groupRank, g.data.name) : "";
  }
  return row;
}

/** File name of a clade's genomes: "class:mammalia" -> "mitoage-class-mammalia-mitochondrial-genomes.fasta". */
export const cladeFastaName = (cladeKey: string): string =>
  `mitoage-${cladeKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-mitochondrial-genomes.fasta`;
