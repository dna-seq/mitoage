/**
 * Sortable species table of a clade (DataTable). Small clades pass every row inline; large
 * ones pass the first page (rendered on the server, so the links are crawlable) and the
 * island loads the rest from the shared tree data, which keeps the HTML small.
 *
 * Once it holds every species of the clade, the table offers their genomes as one FASTA file
 * (DataTable's `fasta`): the rows shown, after the table's filters and in its order.
 *
 * <CladeSpeciesTable client:visible cladeKey="class:mammalia" total={390} rows={firstRows}
 *   groupRank="order" caption="Species in Mammalia" />
 */
import { createSignal, onMount } from "solid-js";
import DataTable, { type Column, type Row } from "~/components/ui/DataTable";
import type { Rank } from "~/data/schema";
import { loadTree } from "~/lib/tree/data";
import { RANK_LABEL } from "~/lib/tree/names";
import { cladeFastaName, leafRow, REFSEQ_KEY } from "~/lib/tree/speciesRows";
import { parseKey } from "~/lib/tree/types";

export interface CladeSpeciesTableProps {
  /** "rank:slug" of the clade. */
  cladeKey: string;
  /** Number of species in the clade. */
  total: number;
  /** Inline rows (speciesRow): all of them, or the first page by lifespan. */
  rows: Row[];
  /** Rank shown as an extra column (e.g. the order of each species on a class page). */
  groupRank?: Rank;
  caption: string;
  pageSize?: number;
}

export const speciesColumns = (groupRank?: Rank): Column[] => [
  { key: "name", label: "Species", kind: "sci", hrefKey: "href", primary: true },
  { key: "common", label: "Common name" },
  ...(groupRank ? [{ key: "group", label: RANK_LABEL[groupRank] } satisfies Column] : []),
  { key: "life", label: "Max lifespan", format: "lifespan" },
  { key: "size", label: "mtDNA size", format: "bp" },
  { key: "gc", label: "GC", format: "pct2", title: "Whole-genome GC content" },
];

export default function CladeSpeciesTable(props: CladeSpeciesTableProps) {
  const [rows, setRows] = createSignal<Row[]>(props.rows);

  onMount(() => {
    if (props.rows.length >= props.total) return;
    const k = parseKey(props.cladeKey);
    if (!k) return;
    loadTree()
      .then((m) => {
        const node = m.byKey.get(`${k[0]}:${k[1]}`);
        if (node) setRows(node.leaves().map((l) => leafRow(l, props.groupRank)));
      })
      .catch(() => {
        // Keep the first page; the rest stays reachable through the species index.
      });
  });

  const big = () => props.total > 25;
  /** Not while only the first page is here: a file of 20 genomes would pass for the clade's. */
  const complete = () => rows().length >= props.total;

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
      {...(complete()
        ? {
            fasta: {
              key: REFSEQ_KEY,
              filename: cladeFastaName(props.cladeKey),
              label: props.total === 1 ? "FASTA of this species" : "FASTA of these species",
            },
          }
        : {})}
    />
  );
}
