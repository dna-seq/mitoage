/**
 * Lifespan-correlation map of a group: a table of regions (rows) by parameters (columns), each
 * cell coloured by the Pearson r of that parameter with log10 maximum lifespan and carrying the
 * number. Cells whose q-value (Benjamini-Hochberg over the whole map) is below 0.05 are bold.
 * Hover or tap a cell for its numbers; a column header picks that parameter for the charts and
 * tables of the page. Data: corrMap() in ~/lib/compare/charts.
 */
import { createSignal, For, Show } from "solid-js";
import { type CorrMapData, corrShade, fmtRShort, MAP_Q, MAP_R_LIMIT } from "~/lib/compare/charts";
import { compareRegionUrl, getParam, type ParamKey, statsRegionLabel } from "~/lib/compare/params";
import { fmtP, fmtR } from "~/lib/explore/format";
import { correlationCI } from "~/lib/explore/stats";
import { fmtInt } from "~/lib/format";

export interface CorrMapProps {
  map: CorrMapData;
  /** The parameter the page's tables show: its column is marked. */
  param: ParamKey;
  /** A column was chosen: show that parameter's r in every region. */
  onSelect: (k: ParamKey) => void;
  /** "all species", "Mammalia". */
  groupName: string;
}

export default function CorrMap(props: CorrMapProps) {
  const [active, setActive] = createSignal<[region: number, param: number] | null>(null);
  const cell = () => {
    const a = active();
    if (!a) return null;
    const c = props.map.cells[a[0]]?.[a[1]];
    const region = props.map.regions[a[0]];
    const key = props.map.params[a[1]];
    return c && region && key ? { c, region, key } : null;
  };
  const isActive = (ri: number, pi: number) => active()?.[0] === ri && active()?.[1] === pi;

  return (
    <figure class="cmap">
      <div class="cmap__scroll">
        <table class="cmap__table">
          <caption class="visually-hidden">
            Pearson r of each parameter with log10 maximum lifespan in each region, across {props.groupName}
          </caption>
          <thead>
            <tr>
              <th scope="col" class="cmap__corner">
                <span class="visually-hidden">Region</span>
              </th>
              <For each={props.map.params}>
                {(k) => (
                  <th scope="col">
                    <button
                      type="button"
                      class="cmap__col"
                      aria-pressed={k === props.param}
                      title={`${getParam(k).title}. Chart its r in every region.`}
                      onClick={() => props.onSelect(k)}
                    >
                      <span>{getParam(k).label}</span>
                    </button>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}>
            <For each={props.map.regions}>
              {(region, ri) => (
                <tr>
                  <th scope="row">
                    <a href={compareRegionUrl(region)}>{statsRegionLabel(region)}</a>
                  </th>
                  <For each={props.map.params}>
                    {(_, pi) => {
                      const c = props.map.cells[ri()]?.[pi()];
                      const r = c?.r ?? null;
                      const cls = [
                        "cmap__cell",
                        r === null ? "is-none" : r < 0 ? "is-neg" : "is-pos",
                        c?.q !== null && c?.q !== undefined && c.q < MAP_Q ? "is-sig" : "",
                      ];
                      return (
                        <td
                          class={`${cls.filter(Boolean).join(" ")}${isActive(ri(), pi()) ? " is-active" : ""}`}
                          style={{ "--t": `${(corrShade(r) * 100).toFixed(1)}%` }}
                          onPointerEnter={() => setActive([ri(), pi()])}
                          onPointerDown={() => setActive([ri(), pi()])}
                        >
                          {fmtRShort(r)}
                        </td>
                      );
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <p class="cmap__detail" aria-live="polite">
        <Show when={cell()} fallback="Hover or tap a cell for its numbers.">
          {(x) => {
            const ci = () => (x().c.r === null ? null : correlationCI(x().c.r ?? 0, x().c.n));
            return (
              <>
                <b>
                  {statsRegionLabel(x().region)} · {getParam(x().key).label}
                </b>
                <Show when={x().c.r !== null} fallback={<span>no correlation: fewer than 5 species, or no variation</span>}>
                  <span>r = {fmtR(x().c.r, 3)}</span>
                  <Show when={ci()}>{(i) => <span>95% CI {fmtR(i()[0], 2)} to {fmtR(i()[1], 2)}</span>}</Show>
                  <span>p = {fmtP(x().c.p)}</span>
                  <span>q = {fmtP(x().c.q)}</span>
                </Show>
                <span>{fmtInt(x().c.n)} species</span>
                <button type="button" class="cmap__go" onClick={() => props.onSelect(x().key)}>
                  Chart {getParam(x().key).label} in every region
                </button>
              </>
            );
          }}
        </Show>
      </p>
      <figcaption class="stack" style={{ "--stack-gap": "var(--space-2)" }}>
        <div class="cmap__scale">
          <span>r ≤ −{MAP_R_LIMIT}</span>
          <span class="cmap__ramp" aria-hidden="true" />
          <span>r ≥ +{MAP_R_LIMIT}</span>
          <span class="cmap__sig">
            <b>bold</b>: q &lt; {MAP_Q}
          </span>
        </div>
        <p class="chart__note">
          Pearson r of each parameter with log₁₀ maximum lifespan (5 or more species): positive where the value is higher
          in longer-lived species. q is the Benjamini–Hochberg q-value over the {fmtInt(props.map.tests)} correlations of
          this map; nothing here is corrected for shared ancestry. AT % is left out: it is 100 − GC %, so its r is that
          of GC % with the opposite sign.
        </p>
      </figcaption>
    </figure>
  );
}
