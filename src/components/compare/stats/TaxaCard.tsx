/**
 * Taxa compared on one region and parameter: one row per class, order, family or genus inside a
 * scope. The first view comes from the build; other views are computed in the browser from
 * /compare/taxonomy.json and /compare/values/{region}.json.
 */
import { createEffect, createSignal, on, Show } from "solid-js";
import DataTable, { type Row } from "~/components/ui/DataTable";
import type { Region } from "~/data/schema";
import { loadRegionValues, loadTaxonomy } from "~/lib/compare/client";
import { getParam, type ParamKey, regionPhrase, regionSlug } from "~/lib/compare/params";
import { type PackedRows, type Scope, type TaxonRank, taxaColumns, taxaRows, unpackRows } from "~/lib/compare/rows";
import { ParamSwitch, RANK_LABEL, RankSwitch, RegionSelect } from "./Controls";

export interface TaxaCardProps {
  id: string;
  /** Heading, e.g. "Orders of Mammalia"; may depend on the rank. */
  title: (rank: TaxonRank, region: Region) => string;
  scope: Scope;
  /** File-name stem for CSV downloads, e.g. "mammalia". */
  csvStem: string;
  ranks: readonly TaxonRank[];
  rank: () => TaxonRank;
  setRank: (r: TaxonRank) => void;
  /** The region select is shown when `setRegion` is given. */
  region: () => Region;
  setRegion?: (r: Region) => void;
  param: () => ParamKey;
  setParam: (k: ParamKey) => void;
  /** Rows for the view rendered at build time. */
  initial: { rank: TaxonRank; region: Region; param: ParamKey; rows: PackedRows };
}

export default function TaxaCard(props: TaxaCardProps) {
  const [rows, setRows] = createSignal<Row[]>(unpackRows(props.initial.rows));
  const [shown, setShown] = createSignal({ rank: props.initial.rank, region: props.initial.region, param: props.initial.param });
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  createEffect(
    on([props.rank, props.region, props.param], ([rank, region, param]) => {
      const cur = shown();
      if (cur.rank === rank && cur.region === region && cur.param === param) return;
      setLoading(true);
      setError("");
      Promise.all([loadTaxonomy(), loadRegionValues(region)])
        .then(([tax, values]) => {
          setRows(taxaRows(tax, values, props.scope, rank, param));
          setShown({ rank, region, param });
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    }),
  );

  const p = () => getParam(shown().param);
  return (
    <section class="card cs-card" id={props.id} aria-labelledby={`${props.id}-title`}>
      <div class="card__head cs-card__head">
        <h2 id={`${props.id}-title`} class="card__title">
          {props.title(shown().rank, shown().region)}
        </h2>
        <span class="card__desc">
          {p().noun.charAt(0).toUpperCase() + p().noun.slice(1)} of {regionPhrase(shown().region)}
          {p().unit === "%" ? ", % of A + C + G + T" : ""}
        </span>
      </div>
      <div class="cs-controls">
        <Show when={props.ranks.length > 1}>
          <RankSwitch value={props.rank()} ranks={props.ranks} onChange={props.setRank} />
        </Show>
        <Show when={props.setRegion}>
          <RegionSelect id={props.id} value={props.region()} onChange={(r) => props.setRegion?.(r)} />
        </Show>
        <ParamSwitch id={props.id} value={props.param()} onChange={props.setParam} />
      </div>
      <p class="cs-status" aria-live="polite">
        {loading() ? "Loading…" : error() ? `Could not load the data (${error()}).` : ""}
      </p>
      <DataTable
        caption={props.title(shown().rank, shown().region)}
        columns={taxaColumns(shown().param, shown().rank)}
        rows={rows()}
        initialSort={{ key: "n", dir: "desc" }}
        pageSize={15}
        csv={{
          filename: `mitoage-${props.csvStem}-${RANK_LABEL[shown().rank].toLowerCase()}-${regionSlug(shown().region)}-${shown().param}.csv`,
        }}
        noun={["taxon", "taxa"]}
      />
    </section>
  );
}
