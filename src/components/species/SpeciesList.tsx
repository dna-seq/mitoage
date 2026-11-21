/**
 * The species list, genome or life-history view. The page renders the first rows at build time;
 * on load the island fetches /species/table.json with every species, so the page stays small.
 */
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import DataTable, { type Row } from "~/components/ui/DataTable";
import { CONFIDENCE_LABEL, CONFIDENCE_LEVELS, CONFIDENCE_MEANING, type ConfidenceLevel, DEFAULT_SHOWN_LEVELS, LEVELS_PARAM, levelsFromQuery, levelsQueryValue, rowsAtLevels } from "~/lib/confidence";
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
  // Which confidence levels are listed: all but the lowest, until the visitor ticks it. The choice is kept in the
  // page address, so a link opens the same list.
  const [shown, setShown] = createSignal<ReadonlySet<ConfidenceLevel>>(new Set(DEFAULT_SHOWN_LEVELS));
  const toggle = (l: ConfidenceLevel) => {
    const next = new Set(shown());
    if (next.has(l)) next.delete(l);
    else next.add(l);
    setShown(next);
    const url = new URL(window.location.href);
    const v = levelsQueryValue(next);
    if (v === null) url.searchParams.delete(LEVELS_PARAM);
    else url.searchParams.set(LEVELS_PARAM, v);
    window.history.replaceState(window.history.state, "", url.href.replace(/%2C/gi, ","));
  };
  const counts = createMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows()) c[String(r.confidence)] = (c[String(r.confidence)] ?? 0) + 1;
    return c;
  });
  // A row without a level (a build before the level existed) is always listed.
  const visible = createMemo(() => rowsAtLevels(rows(), (r) => r.confidence, shown()));
  const hidden = () => rows().length - visible().length;
  onMount(() => {
    setShown(new Set(levelsFromQuery(window.location.search)));
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
      <fieldset class="conf-pick">
        <legend>Confidence in the record</legend>
        <For each={CONFIDENCE_LEVELS}>
          {(l) => (
            <label title={CONFIDENCE_MEANING[l]}>
              <input type="checkbox" checked={shown().has(l)} onChange={() => toggle(l)} />
              <span class={`conf conf--${l}`}>{CONFIDENCE_LABEL[l]}</span>
              <Show when={state() === "ready"}>
                <span class="conf-pick__count">{(counts()[l] ?? 0).toLocaleString("en-US")}</span>
              </Show>
            </label>
          )}
        </For>
        <Show when={state() === "ready" && hidden() > 0}>
          <p class="conf-pick__note" aria-live="polite">
            {hidden().toLocaleString("en-US")} species not listed: their level is unticked.
          </p>
        </Show>
      </fieldset>
      <DataTable
        caption={props.view === "genome" ? "Species and their mitochondrial genomes" : "Species and their life history"}
        columns={SPECIES_COLUMNS[props.view]}
        rows={visible()}
        initialSort={props.initialSort}
        pageSize={50}
        search={{ keys: SPECIES_SEARCH_KEYS, placeholder: "Filter by name, class, order or family" }}
        facets={[{ key: "cls", label: "Class", allLabel: "All classes" }]}
        urlParam="q"
        noun={["species", "species"]}
        csv={{ filename: props.view === "genome" ? "mitoage-species-genomes.csv" : "mitoage-species-life-history.csv", label: "CSV of these rows" }}
        fasta={{ key: "refseq", filename: "mitoage-mitochondrial-genomes.fasta", label: "FASTA of these rows" }}
      />
    </>
  );
}
