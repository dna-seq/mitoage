/**
 * One region across all species, grouped by class, order or family (region page). Mirrors
 * ?param= and ?rank= in the query string.
 */
import { createEffect, createSignal, on, onMount } from "solid-js";
import type { Region } from "~/data/schema";
import { queryParam, setQuery } from "~/lib/compare/client";
import { DEFAULT_PARAM, isParamKey, type ParamKey, statsRegionLabel } from "~/lib/compare/params";
import type { PackedRows, TaxonRank } from "~/lib/compare/rows";
import TaxaCard from "./TaxaCard";

export interface RegionTaxaProps {
  region: Region;
  rows: PackedRows;
}

const RANKS: TaxonRank[] = ["class", "order", "family"];

export default function RegionTaxa(props: RegionTaxaProps) {
  const [param, setParam] = createSignal<ParamKey>(DEFAULT_PARAM);
  const [rank, setRank] = createSignal<TaxonRank>("class");
  onMount(() => {
    const p = queryParam("param");
    const k = queryParam("rank");
    if (p && isParamKey(p)) setParam(p);
    if (k && (RANKS as string[]).includes(k)) setRank(k as TaxonRank);
  });
  createEffect(
    on([param, rank], ([p, k]) => setQuery({ param: p === DEFAULT_PARAM ? null : p, rank: k === "class" ? null : k }), {
      defer: true,
    }),
  );
  const region = () => props.region;
  return (
    <TaxaCard
      id="taxa"
      title={(k) => `${statsRegionLabel(props.region)} by ${k}`}
      scope={{ rank: "all", name: "" }}
      csvStem="all"
      ranks={RANKS}
      rank={rank}
      setRank={setRank}
      region={region}
      param={param}
      setParam={setParam}
      initial={{ rank: "class", region: props.region, param: DEFAULT_PARAM, rows: props.rows }}
    />
  );
}
