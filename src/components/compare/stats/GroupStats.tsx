/**
 * Comparative charts and tables of one group (all species, a class, an order or a family): every
 * region on one parameter, then the group's child taxa on one region and parameter. Each table
 * has a chart of its rows above it; the regions chart can also show the lifespan-correlation map
 * of every parameter. The parameter and the chart are shared by both cards and mirrored in the
 * query string (?param=gc&region=nd6&chart=r), so views are links.
 */
import { createEffect, createSignal, on, onMount, Show } from "solid-js";
import DataTable, { type Row } from "~/components/ui/DataTable";
import type { Region } from "~/data/schema";
import {
  type CorrMapData,
  corrMap,
  DEFAULT_PLOT,
  isPlotKey,
  type PlotKey,
  rangePlotOf,
  REGION_SWATCHES,
  regionColor,
  regionSwatchKey,
} from "~/lib/compare/charts";
import { loadGroupStats, queryParam, setQuery } from "~/lib/compare/client";
import {
  DEFAULT_PARAM,
  getParam,
  isParamKey,
  type ParamKey,
  regionFromSlug,
  regionSlug,
} from "~/lib/compare/params";
import { type PackedRows, regionColumns, regionRows, type Scope, type TaxonRank, unpackRows } from "~/lib/compare/rows";
import { ParamSwitch, PlotSwitch } from "./Controls";
import CorrMap from "./CorrMap";
import RowsChart from "./RowsChart";
import TaxaCard from "./TaxaCard";

export const DEFAULT_TAXA_REGION: Region = "total_mtDNA";

export interface GroupStatsProps {
  groupKey: string;
  /** "all species", "Mammalia". */
  groupName: string;
  scope: Scope;
  /** Ranks the taxa table can show, the first is the default (e.g. ["order", "family"] in a class). */
  childRanks: TaxonRank[];
  regionRows: PackedRows;
  taxaRows: PackedRows;
}

const RANK_TITLE: Record<TaxonRank, string> = { class: "Classes", order: "Orders", family: "Families", genus: "Genera" };

const regionOf = (row: Row): string => (typeof row["region"] === "string" ? row["region"] : "");
const regionSwatches = (rows: Row[]) => {
  const present = new Set(rows.map((r) => regionSwatchKey(regionOf(r))));
  return REGION_SWATCHES.filter((s) => present.has(s.key));
};

export default function GroupStats(props: GroupStatsProps) {
  const [param, setParam] = createSignal<ParamKey>(DEFAULT_PARAM);
  const [region, setRegion] = createSignal<Region>(DEFAULT_TAXA_REGION);
  const [rank, setRank] = createSignal<TaxonRank>(props.childRanks[0] ?? "class");
  const [plot, setPlot] = createSignal<PlotKey>(DEFAULT_PLOT);
  const [rows, setRows] = createSignal<Row[]>(unpackRows(props.regionRows));
  const [shownParam, setShownParam] = createSignal<ParamKey>(DEFAULT_PARAM);
  const [map, setMap] = createSignal<CorrMapData | null>(null);
  const [status, setStatus] = createSignal("");

  onMount(() => {
    const p = queryParam("param");
    const r = regionFromSlug(queryParam("region") ?? "");
    const k = queryParam("rank");
    const c = queryParam("chart");
    if (p && isParamKey(p)) setParam(p);
    if (r) setRegion(r);
    if (k && (props.childRanks as string[]).includes(k)) setRank(k as TaxonRank);
    if (c && isPlotKey(c)) setPlot(c);
  });

  createEffect(
    on([param, region, rank, plot], ([p, r, k, c]) => {
      setQuery({
        param: p === DEFAULT_PARAM ? null : p,
        region: r === DEFAULT_TAXA_REGION ? null : regionSlug(r),
        rank: k === props.childRanks[0] ? null : k,
        chart: c === DEFAULT_PLOT ? null : c,
      });
    }, { defer: true }),
  );

  const failed = (e: unknown) => setStatus(`Could not load the data (${e instanceof Error ? e.message : String(e)}).`);

  createEffect(
    on(param, (p) => {
      if (p === shownParam()) return;
      setStatus("Loading…");
      loadGroupStats(props.groupKey)
        .then((file) => {
          setRows(regionRows(file, p));
          setShownParam(p);
          setStatus("");
        })
        .catch(failed);
    }),
  );

  // The map needs every parameter of the group: loaded when the reader first opens it.
  createEffect(
    on(plot, (c) => {
      if (c !== "map" || map()) return;
      loadGroupStats(props.groupKey)
        .then((file) => setMap(corrMap(file)))
        .catch(failed);
    }),
  );

  const title = () => `${getParam(shownParam()).label} of every region`;
  const stem = props.groupKey;
  const desc = () => {
    const p = getParam(shownParam());
    if (plot() === "map") return `Correlation of every parameter with maximum lifespan, region by region, across ${props.groupName}`;
    return `${p.noun.charAt(0).toUpperCase() + p.noun.slice(1)} of each region across ${props.groupName}${p.unit === "%" ? ", % of A + C + G + T" : ""}`;
  };

  return (
    <>
      <section class="card cs-card" id="regions" aria-labelledby="regions-title">
        <div class="card__head cs-card__head">
          <h2 id="regions-title" class="card__title">
            Regions
          </h2>
          <span class="card__desc">{desc()}</span>
        </div>
        <div class="cs-controls">
          <ParamSwitch id="regions" value={param()} onChange={setParam} />
          <PlotSwitch id="regions" value={plot()} onChange={setPlot} />
        </div>
        <p class="cs-status" aria-live="polite">
          {status()}
        </p>
        {/* The map is a table of its own, so it stays outside the DataTable, whose cell styles would reach it. */}
        <Show when={plot() === "map"}>
          <Show when={map()} fallback={<p class="cs-status">{status() || "Loading the map…"}</p>}>
            {(m) => (
              <CorrMap
                map={m()}
                param={param()}
                groupName={props.groupName}
                onSelect={(k) => {
                  setParam(k);
                  setPlot("r");
                }}
              />
            )}
          </Show>
        </Show>
        <DataTable
          caption={title()}
          columns={regionColumns(shownParam())}
          rows={rows()}
          initialSort={{ key: "order", dir: "asc" }}
          csv={{ filename: `mitoage-${stem}-regions-${shownParam()}.csv` }}
          noun={["region", "regions"]}
          figure={({ visible }) => (
            <Show when={plot() !== "map"}>
              <RowsChart
                rows={visible()}
                total={rows().length}
                plot={rangePlotOf(plot())}
                param={shownParam()}
                color={(row) => regionColor(regionOf(row))}
                swatches={regionSwatches}
                what={`regions of the mitochondrial genome across ${props.groupName}`}
                allowLog
              />
            </Show>
          )}
        />
      </section>
      <TaxaCard
        id="taxa"
        title={(k) => `${RANK_TITLE[k]} ${props.scope.rank === "all" ? "compared" : `of ${props.groupName}`}`}
        scope={props.scope}
        csvStem={stem}
        ranks={props.childRanks}
        rank={rank}
        setRank={setRank}
        region={region}
        setRegion={setRegion}
        param={param}
        setParam={setParam}
        plot={plot}
        setPlot={setPlot}
        initial={{ rank: props.childRanks[0] ?? "class", region: DEFAULT_TAXA_REGION, param: DEFAULT_PARAM, rows: props.taxaRows }}
      />
    </>
  );
}
