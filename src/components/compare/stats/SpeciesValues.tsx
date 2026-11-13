/**
 * Every species' values for one region (region page): length, base counts, GC %, skews and
 * lifespan, searchable by name or taxon (?q=), filterable by class, sortable, with a CSV of the
 * filtered rows. Loads /compare/taxonomy.json and /compare/values/{region}.json when visible.
 */
import { createSignal, onMount, Show } from "solid-js";
import DataTable, { type Row } from "~/components/ui/DataTable";
import type { Region } from "~/data/schema";
import { loadRegionValues, loadTaxonomy } from "~/lib/compare/client";
import { regionSlug, regionValuesCsvUrl, statsRegionLabel } from "~/lib/compare/params";
import { speciesColumns, speciesRows } from "~/lib/compare/rows";

export default function SpeciesValues(props: { region: Region; count: number }) {
  // Load in the browser only: fetching during server rendering would fail and be serialised.
  const [rows, setRows] = createSignal<Row[] | null>(null);
  const [failed, setFailed] = createSignal(false);
  onMount(() => {
    Promise.all([loadTaxonomy(), loadRegionValues(props.region)])
      .then(([tax, values]) => setRows(speciesRows(tax, values)))
      .catch(() => setFailed(true));
  });
  return (
    <Show
      when={rows()}
      fallback={
        <p class="cs-status">
          {failed() ? (
            <>
              Could not load the table. <a href={regionValuesCsvUrl(props.region)}>Download it as CSV</a> instead.
            </>
          ) : (
            `Loading ${props.count.toLocaleString("en-US")} species…`
          )}
        </p>
      }
    >
      {(r) => (
        <DataTable
          caption={`${statsRegionLabel(props.region)} in every species`}
          columns={speciesColumns()}
          rows={r()}
          initialSort={{ key: "name", dir: "asc" }}
          pageSize={50}
          search={{ keys: ["name", "common", "cls", "className", "order", "family"], placeholder: "Filter by species, class, order or family" }}
          facets={[{ key: "cls", label: "Class", allLabel: "All classes" }]}
          urlParam="q"
          noun={["species", "species"]}
          csv={{ filename: `mitoage-${regionSlug(props.region)}-species.csv`, label: "CSV of these rows" }}
        />
      )}
    </Show>
  );
}
