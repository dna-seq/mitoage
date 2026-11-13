/** Shared controls of the comparative tables: chart and parameter switches, region and rank selects. */
import { For } from "solid-js";
import type { Region } from "~/data/schema";
import { PROTEIN_GENES } from "~/data/schema";
import { type PlotKey, PLOTS } from "~/lib/compare/charts";
import { getParam, PARAMS, type ParamKey, STATS_REGIONS, statsRegionLabel } from "~/lib/compare/params";
import type { TaxonRank } from "~/lib/compare/rows";

/** Parameter switch: pills on wide screens, a select on phones (see stats.css). */
export function ParamSwitch(p: { value: ParamKey; onChange: (k: ParamKey) => void; id: string }) {
  return (
    <div class="cs-param">
      <div class="seg cs-param__seg" role="group" aria-label="Parameter">
        <For each={PARAMS}>
          {(x) => (
            <button
              type="button"
              class="seg__btn"
              aria-pressed={p.value === x.key}
              title={x.title}
              onClick={() => p.onChange(x.key)}
            >
              {x.label}
            </button>
          )}
        </For>
      </div>
      <label class="field cs-param__select" for={`${p.id}-param`}>
        Parameter
        <select
          id={`${p.id}-param`}
          class="select"
          value={p.value}
          onChange={(e) => p.onChange(getParam(e.currentTarget.value).key)}
        >
          <For each={PARAMS}>{(x) => <option value={x.key}>{x.label}</option>}</For>
        </select>
      </label>
    </div>
  );
}

/** What the chart above a table plots: pills on wide screens, a select on phones, like ParamSwitch. */
export function PlotSwitch(p: { value: PlotKey; onChange: (k: PlotKey) => void; id: string; plots?: readonly PlotKey[] }) {
  const list = () => PLOTS.filter((x) => !p.plots || p.plots.includes(x.key));
  return (
    <div class="cs-param">
      <div class="seg cs-param__seg" role="group" aria-label="Chart">
        <For each={list()}>
          {(x) => (
            <button
              type="button"
              class="seg__btn"
              aria-pressed={p.value === x.key}
              title={x.title}
              onClick={() => p.onChange(x.key)}
            >
              {x.label}
            </button>
          )}
        </For>
      </div>
      <label class="field cs-param__select" for={`${p.id}-plot`}>
        Chart
        <select
          id={`${p.id}-plot`}
          class="select"
          value={p.value}
          onChange={(e) => p.onChange((list().find((x) => x.key === e.currentTarget.value) ?? list()[0]!).key)}
        >
          <For each={list()}>{(x) => <option value={x.key}>{x.label}</option>}</For>
        </select>
      </label>
    </div>
  );
}

const AGG = STATS_REGIONS.filter((r) => !(PROTEIN_GENES as readonly string[]).includes(r));

export function RegionSelect(p: {
  value: Region;
  onChange: (r: Region) => void;
  id: string;
  regions?: readonly Region[];
  label?: string;
}) {
  const allowed = (r: Region) => !p.regions || p.regions.includes(r);
  return (
    <label class="field" for={`${p.id}-region`}>
      {p.label ?? "Region"}
      <select
        id={`${p.id}-region`}
        class="select"
        value={p.value}
        onChange={(e) => p.onChange(e.currentTarget.value as Region)}
      >
        <optgroup label={p.regions ? "All genes" : "Whole genome and gene sets"}>
          <For each={AGG.filter(allowed)}>{(r) => <option value={r}>{statsRegionLabel(r)}</option>}</For>
        </optgroup>
        <optgroup label="Protein-coding genes">
          <For each={PROTEIN_GENES.filter(allowed)}>{(r) => <option value={r}>{r}</option>}</For>
        </optgroup>
      </select>
    </label>
  );
}

export const RANK_LABEL: Record<TaxonRank, string> = {
  class: "Classes",
  order: "Orders",
  family: "Families",
  genus: "Genera",
};

export function RankSwitch(p: { value: TaxonRank; ranks: readonly TaxonRank[]; onChange: (r: TaxonRank) => void }) {
  return (
    <div class="seg" role="group" aria-label="Group by">
      <For each={p.ranks}>
        {(r) => (
          <button type="button" class="seg__btn" aria-pressed={p.value === r} onClick={() => p.onChange(r)}>
            {RANK_LABEL[r]}
          </button>
        )}
      </For>
    </div>
  );
}
