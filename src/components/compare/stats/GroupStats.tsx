/**
 * Comparative tables of one group (all species, a class, an order or a family): every region on
 * one parameter, then the group's child taxa on one region and parameter. The parameter is shared
 * by both tables and mirrored in the query string (?param=gc&region=nd6), so views are links.
 */
import { createEffect, createSignal, on, onMount } from "solid-js";
import DataTable, { type Row } from "~/components/ui/DataTable";
import type { Region } from "~/data/schema";
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
import { ParamSwitch } from "./Controls";
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

export default function GroupStats(props: GroupStatsProps) {
  const [param, setParam] = createSignal<ParamKey>(DEFAULT_PARAM);
  const [region, setRegion] = createSignal<Region>(DEFAULT_TAXA_REGION);
  const [rank, setRank] = createSignal<TaxonRank>(props.childRanks[0] ?? "class");
  const [rows, setRows] = createSignal<Row[]>(unpackRows(props.regionRows));
  const [shownParam, setShownParam] = createSignal<ParamKey>(DEFAULT_PARAM);
  const [status, setStatus] = createSignal("");

  onMount(() => {
    const p = queryParam("param");
    const r = regionFromSlug(queryParam("region") ?? "");
    const k = queryParam("rank");
    if (p && isParamKey(p)) setParam(p);
    if (r) setRegion(r);
    if (k && (props.childRanks as string[]).includes(k)) setRank(k as TaxonRank);
  });

  createEffect(
    on([param, region, rank], ([p, r, k]) => {
      setQuery({
        param: p === DEFAULT_PARAM ? null : p,
        region: r === DEFAULT_TAXA_REGION ? null : regionSlug(r),
        rank: k === props.childRanks[0] ? null : k,
      });
    }, { defer: true }),
  );

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
        .catch((e: unknown) => setStatus(`Could not load the data (${e instanceof Error ? e.message : String(e)}).`));
    }),
  );

  const title = () => `${getParam(shownParam()).label} of every region`;
  const stem = props.groupKey;

  return (
    <>
      <section class="card cs-card" id="regions" aria-labelledby="regions-title">
        <div class="card__head cs-card__head">
          <h2 id="regions-title" class="card__title">
            Regions
          </h2>
          <span class="card__desc">
            {getParam(shownParam()).noun.charAt(0).toUpperCase() + getParam(shownParam()).noun.slice(1)} of each region
            across {props.groupName}
            {getParam(shownParam()).unit === "%" ? ", % of A + C + G + T" : ""}
          </span>
        </div>
        <div class="cs-controls">
          <ParamSwitch id="regions" value={param()} onChange={setParam} />
        </div>
        <p class="cs-status" aria-live="polite">
          {status()}
        </p>
        <DataTable
          caption={title()}
          columns={regionColumns(shownParam())}
          rows={rows()}
          initialSort={{ key: "order", dir: "asc" }}
          csv={{ filename: `mitoage-${stem}-regions-${shownParam()}.csv` }}
          noun={["region", "regions"]}
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
        initial={{ rank: props.childRanks[0] ?? "class", region: DEFAULT_TAXA_REGION, param: DEFAULT_PARAM, rows: props.taxaRows }}
      />
    </>
  );
}
