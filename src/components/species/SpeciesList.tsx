/**
 * The species list, genome or life-history view. The page renders the first rows at build time;
 * on load the island fetches /species/table.json with every species, so the page stays small.
 */
import { createSignal, onMount, Show } from "solid-js";
import DataTable, { type Row } from "~/components/ui/DataTable";
import {
  SPECIES_COLUMNS,
  SPECIES_SEARCH_KEYS,
  SPECIES_TABLE_URL,
  type SpeciesTableFile,
  TABLE_FIELDS,
  type SpeciesView,
  tableRow,
} from "~/lib/speciesTable";

export interface SpeciesListProps {
  view: SpeciesView;
  /** First rows in the default sort, in TABLE_FIELDS order (compact props). */
  raw: (string | number | null)[][];
  total: number;
  initialSort: { key: string; dir: "asc" | "desc" };
}

export default function SpeciesList(props: SpeciesListProps) {
  const [rows, setRows] = createSignal<Row[]>(props.raw.map((r) => tableRow(TABLE_FIELDS, r)));
  const [state, setState] = createSignal<"loading" | "ready" | "error">("loading");
  onMount(() => {
    fetch(SPECIES_TABLE_URL)
      .then((r) => (r.ok ? (r.json() as Promise<SpeciesTableFile>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((f) => {
        setRows(f.rows.map((r) => tableRow(f.fields, r)));
        setState("ready");
      })
      .catch(() => setState("error"));
  });
  return (
    <>
      <Show when={state() !== "ready"}>
        <p class="sp-list__status" aria-live="polite">
          {state() === "loading"
            ? `Loading all ${props.total.toLocaleString("en-US")} species…`
            : "Could not load the full list; showing the first rows."}
        </p>
      </Show>
      <DataTable
        caption={props.view === "genome" ? "Species and their mitochondrial genomes" : "Species and their life history"}
        columns={SPECIES_COLUMNS[props.view]}
        rows={rows()}
        initialSort={props.initialSort}
        pageSize={50}
        search={{ keys: SPECIES_SEARCH_KEYS, placeholder: "Filter by name, class, order or family" }}
        facets={[{ key: "cls", label: "Class", allLabel: "All classes" }]}
        urlParam="q"
        noun={["species", "species"]}
        csv={{ filename: props.view === "genome" ? "mitoage-species-genomes.csv" : "mitoage-species-life-history.csv", label: "CSV of these rows" }}
      />
    </>
  );
}
