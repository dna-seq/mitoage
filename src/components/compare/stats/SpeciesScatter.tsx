/**
 * Scatter of the species of one region (region page): any two of the region's parameters, or one
 * against maximum lifespan, coloured by class. It plots the rows the species table currently
 * shows, so the table's search and class filter narrow the plot too, and the statistics describe
 * exactly the plotted species. ?x= and ?y= keep the axes in the address.
 */
import { createEffect, createMemo, createSignal, For, on, onMount, Show } from "solid-js";
import Scatter from "~/components/charts/Scatter";
import type { Row } from "~/components/ui/DataTable";
import type { Region } from "~/data/schema";
import { CLASS_GROUPS } from "~/lib/classes";
import {
  DEFAULT_SCATTER_X,
  DEFAULT_SCATTER_Y,
  getScatterAxis,
  isScatterAxisKey,
  SCATTER_AXES,
  type ScatterAxisKey,
  speciesScatter,
} from "~/lib/compare/charts";
import { queryParam, setQuery } from "~/lib/compare/client";
import { regionPhrase } from "~/lib/compare/params";
import { fmtP, fmtR } from "~/lib/explore/format";
import { describePairs } from "~/lib/explore/stats";
import { fmtInt } from "~/lib/format";

export default function SpeciesScatter(props: { rows: Row[]; region: Region }) {
  const [xKey, setXKey] = createSignal<ScatterAxisKey>(DEFAULT_SCATTER_X);
  const [yKey, setYKey] = createSignal<ScatterAxisKey>(DEFAULT_SCATTER_Y);
  const [fit, setFit] = createSignal(true);

  onMount(() => {
    const x = queryParam("x");
    const y = queryParam("y");
    if (x && isScatterAxisKey(x)) setXKey(x);
    if (y && isScatterAxisKey(y) && y !== xKey()) setYKey(y);
    else if (yKey() === xKey()) setYKey(xKey() === DEFAULT_SCATTER_Y ? DEFAULT_SCATTER_X : DEFAULT_SCATTER_Y);
  });
  createEffect(
    on(
      [xKey, yKey],
      ([x, y]) => setQuery({ x: x === DEFAULT_SCATTER_X ? null : x, y: y === DEFAULT_SCATTER_Y ? null : y }),
      { defer: true },
    ),
  );

  /** Picking the variable of the other axis swaps the two, so the axes never show the same thing. */
  const pickX = (k: ScatterAxisKey) => {
    if (k === yKey()) setYKey(xKey());
    setXKey(k);
  };
  const pickY = (k: ScatterAxisKey) => {
    if (k === xKey()) setXKey(yKey());
    setYKey(k);
  };
  const swap = () => {
    const x = xKey();
    setXKey(yKey());
    setYKey(x);
  };

  const x = () => getScatterAxis(xKey());
  const y = () => getScatterAxis(yKey());
  const view = createMemo(() => speciesScatter(props.rows, x(), y()));
  const stats = createMemo(() => describePairs(view().tx, view().ty));
  const line = createMemo(() => {
    const v = view();
    const f = stats().fit;
    if (!fit() || !f || v.tx.length < 3) return null;
    const lo = Math.min(...v.tx);
    const hi = Math.max(...v.tx);
    const inv = (t: number, log: boolean) => (log ? 10 ** t : t);
    return {
      x1: inv(lo, x().log),
      y1: inv(f.intercept + f.slope * lo, y().log),
      x2: inv(hi, x().log),
      y2: inv(f.intercept + f.slope * hi, y().log),
    };
  });
  const logNote = () => (x().log || y().log ? ", on log₁₀ lifespan" : "");

  const AxisSelect = (p: { id: string; label: string; value: ScatterAxisKey; onPick: (k: ScatterAxisKey) => void }) => (
    <label class="field" for={p.id}>
      {p.label}
      <select id={p.id} class="select" value={p.value} onChange={(e) => p.onPick(getScatterAxis(e.currentTarget.value).key)}>
        <For each={SCATTER_AXES}>{(a) => <option value={a.key}>{a.label}</option>}</For>
      </select>
    </label>
  );

  return (
    <div class="sps">
      <div class="cs-controls">
        <AxisSelect id="sps-x" label="Horizontal axis" value={xKey()} onPick={pickX} />
        <button type="button" class="btn btn--soft btn--sm sps__swap" onClick={swap} title="Swap the two axes">
          Swap axes
        </button>
        <AxisSelect id="sps-y" label="Vertical axis" value={yKey()} onPick={pickY} />
        <button type="button" role="switch" class="sps__switch" aria-checked={fit()} onClick={() => setFit(!fit())}>
          <span class="sps__switch-track" aria-hidden="true" />
          Fit line
        </button>
      </div>
      <Scatter
        points={view().points}
        groups={CLASS_GROUPS}
        xLabel={x().title}
        yLabel={y().title}
        xLog={x().log}
        yLog={y().log}
        xTickFormat={x().tick}
        yTickFormat={y().tick}
        xValueFormat={x().value}
        yValueFormat={y().value}
        line={line()}
        interactiveLegend
        height={420}
        ariaLabel={`${y().label} against ${x().label} of ${regionPhrase(props.region)}, ${fmtInt(view().points.length)} species`}
        emptyText="No species match the table's filter."
      />
      <p class="sps__stats" aria-live="polite">
        <b>{fmtInt(stats().n)} species</b>
        <Show when={stats().n >= 3} fallback={<span>too few for a correlation</span>}>
          <span>
            Pearson r = {fmtR(stats().pearsonR, 3)} (p = {fmtP(stats().pearsonP)})
          </span>
          <span>
            Spearman ρ = {fmtR(stats().spearmanRho, 3)} (p = {fmtP(stats().spearmanP)})
          </span>
        </Show>
      </p>
      <p class="chart__note">
        The plot shows the species listed in the table below: its search and class filter narrow both. Statistics are
        for the plotted species{logNote()}, and are not corrected for multiple testing or shared ancestry. Hover or tap
        a point to see the species; select it again to open its page.
      </p>
    </div>
  );
}
