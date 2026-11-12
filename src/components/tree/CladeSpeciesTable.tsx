/**
 * Sortable species table of a clade (DataTable). Small clades pass every row inline; large
 * ones pass the first page (rendered on the server, so the links are crawlable) and the
 * island loads the rest from the shared tree data, which keeps the HTML small.
 *
 * <CladeSpeciesTable client:visible cladeKey="class:mammalia" total={390} rows={firstRows}
 *   groupRank="order" caption="Species in Mammalia" />
 */
import { createSignal, onMount } from "solid-js";
import DataTable, { type Column, type Row } from "~/components/ui/DataTable";
import type { Rank } from "~/data/schema";
import { classLabel } from "~/lib/classes";
import { loadTree } from "~/lib/tree/data";
import { RANK_LABEL } from "~/lib/tree/names";
import { parseKey, type TNode } from "~/lib/tree/types";
import { speciesUrl } from "~/lib/urls";

export interface CladeSpeciesTableProps {
  /** "rank:slug" of the clade. */
  cladeKey: string;
  /** Number of species in the clade. */
  total: number;
  /** Inline rows: all of them, or the first page by lifespan. */
  rows: Row[];
  /** Rank shown as an extra column (e.g. the order of each species on a class page). */
  groupRank?: Rank;
  caption: string;
  pageSize?: number;
}

/** Group label of a species at a rank: the friendly name for classes, else the taxon name. */
export const groupLabel = (rank: Rank, name: string): string => (rank === "class" ? classLabel(name) : name);

export const speciesColumns = (groupRank?: Rank): Column[] => [
  { key: "name", label: "Species", kind: "sci", hrefKey: "href", primary: true },
  { key: "common", label: "Common name" },
  ...(groupRank ? [{ key: "group", label: RANK_LABEL[groupRank] } satisfies Column] : []),
  { key: "life", label: "Max lifespan", format: "lifespan" },
  { key: "size", label: "mtDNA size", format: "bp" },
  { key: "gc", label: "GC", format: "pct2", title: "Whole-genome GC content" },
];

const rowFromLeaf = (leaf: TNode, groupRank: Rank | undefined): Row => {
  const sp = leaf.data.sp;
  const row: Row = {
    name: leaf.data.name,
    common: sp?.common ?? "",
    href: speciesUrl(leaf.data.slug),
    life: sp?.life ?? null,
    size: sp?.size ?? null,
    gc: sp?.gc ?? null,
  };
  if (groupRank) {
    const g = leaf.ancestors().find((a) => a.data.rank === groupRank);
    row["group"] = g ? groupLabel(groupRank, g.data.name) : "";
  }
  return row;
};

export default function CladeSpeciesTable(props: CladeSpeciesTableProps) {
  const [rows, setRows] = createSignal<Row[]>(props.rows);

  onMount(() => {
    if (props.rows.length >= props.total) return;
    const k = parseKey(props.cladeKey);
    if (!k) return;
    loadTree()
      .then((m) => {
        const node = m.byKey.get(`${k[0]}:${k[1]}`);
        if (node) setRows(node.leaves().map((l) => rowFromLeaf(l, props.groupRank)));
      })
      .catch(() => {
        // Keep the first page; the rest stays reachable through the species index.
      });
  });

  const big = () => props.total > 25;

  return (
    <DataTable
      caption={props.caption}
      columns={speciesColumns(props.groupRank)}
      rows={rows()}
      initialSort={{ key: "life", dir: "desc" }}
      pageSize={props.pageSize ?? 25}
      noun={["species", "species"]}
      {...(big() ? { search: { keys: ["name", "common", "group"], placeholder: "Filter species" } } : {})}
      {...(big() && props.groupRank ? { facets: [{ key: "group", label: RANK_LABEL[props.groupRank], allLabel: "All" }] } : {})}
    />
  );
}
