/**
 * Dot plot for the compare page: one row per item (gene, codon...), one marker per species
 * (colour + shape), a bar showing the spread. Hover or tap a marker for its value; the exact
 * numbers are also in a table under the plot.
 */
import { scaleLinear } from "d3-scale";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { MarkerShape, Marker } from "./Marker";
import { uiScale } from "~/lib/uiScale";

export interface DotRow {
  key: string;
  label: string;
  /** Optional link for the row label in the table. */
  href?: string;
}

export interface DotSeries {
  id: string;
  label: string;
  /** Series index: colour and shape. */
  i: number;
}

interface Props {
  rows: DotRow[];
  series: DotSeries[];
  /** values[rowKey][seriesId] */
  values: Record<string, Record<string, number | null>>;
  format: (v: number) => string;
  tick?: ((v: number) => string) | undefined;
  axisLabel: string;
  ariaLabel: string;
  caption: string;
  includeZero?: boolean | undefined;
}

interface Mark {
  row: string;
  rowLabel: string;
  s: DotSeries;
  v: number;
  cx: number;
  cy: number;
}

const ROW_H = 32;
const TOP = 46;
const BOTTOM = 10;

export default function DotPlot(props: Props) {
  const [W, setW] = createSignal(640);
  const [hover, setHover] = createSignal<{ row: string; s: DotSeries; v: number; x: number; y: number } | null>(null);
  let frame: HTMLDivElement | undefined;
  let svg: SVGSVGElement | undefined;

  onMount(() => {
    if (frame && "ResizeObserver" in window) {
      const ro = new ResizeObserver((e) => {
        const w = e[0]?.contentRect.width ?? 640;
        if (w > 0) setW(Math.round(Math.max(260, Math.min(1100, w / uiScale()))));
      });
      ro.observe(frame);
      onCleanup(() => ro.disconnect());
    }
  });

  const labelW = () => (W() < 440 ? 70 : 104);
  const H = () => TOP + props.rows.length * ROW_H + BOTTOM;

  const all = createMemo(() => {
    const out: number[] = [];
    for (const r of props.rows)
      for (const s of props.series) {
        const v = props.values[r.key]?.[s.id];
        if (v !== null && v !== undefined && Number.isFinite(v)) out.push(v);
      }
    return out;
  });

  const x = createMemo(() => {
    const vals = all();
    let lo = vals.length ? Math.min(...vals) : 0;
    let hi = vals.length ? Math.max(...vals) : 1;
    if (props.includeZero) {
      lo = Math.min(0, lo);
      hi = Math.max(0, hi);
    }
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.06;
    // Never pad past zero when zero is a bound (e.g. percentages start at 0).
    const d0 = props.includeZero && lo === 0 ? 0 : lo - pad;
    const d1 = props.includeZero && hi === 0 ? 0 : hi + pad;
    return scaleLinear()
      .domain([d0, d1])
      .range([labelW() + 10, W() - 18])
      .nice();
  });
  const ticks = createMemo(() => x().ticks(W() < 440 ? 3 : 6));
  const rowY = (i: number) => TOP + i * ROW_H + ROW_H / 2;
  const offset = (j: number) => (j - (props.series.length - 1) / 2) * 2.6;

  const marks = createMemo<Mark[]>(() =>
    props.rows.flatMap((r, ri) =>
      props.series.flatMap((s, j) => {
        const v = props.values[r.key]?.[s.id];
        return v === null || v === undefined || !Number.isFinite(v)
          ? []
          : [{ row: r.key, rowLabel: r.label, s, v, cx: x()(v), cy: rowY(ri) + offset(j) }];
      }),
    ),
  );

  const spreads = createMemo(() =>
    props.rows.map((r, ri) => {
      const vs = props.series
        .map((s) => props.values[r.key]?.[s.id])
        .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
      return vs.length > 1 ? { y: rowY(ri), x1: x()(Math.min(...vs)), x2: x()(Math.max(...vs)) } : null;
    }),
  );

  const onMove = (e: PointerEvent) => {
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const k = W() / r.width;
    const px = (e.clientX - r.left) * k;
    const py = (e.clientY - r.top) * k;
    let best: Mark | null = null;
    let bd = e.pointerType === "mouse" ? 14 : 24;
    for (const m of marks()) {
      const d = Math.hypot(m.cx - px, m.cy - py);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    setHover(best ? { row: best.rowLabel, s: best.s, v: best.v, x: best.cx / k, y: best.cy / k } : null);
  };

  return (
    <figure class="cmp-dot">
      <div class="cmp-dot__frame" ref={frame}>
        <svg
          ref={svg}
          class="cmp-dot__svg"
          viewBox={`0 0 ${W()} ${H()}`}
          role="img"
          aria-label={props.ariaLabel}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setHover(null);
          }}
        >
          <g class="chart__grid">
            <For each={ticks()}>{(t) => <line x1={x()(t)} x2={x()(t)} y1={TOP - 8} y2={H() - BOTTOM} />}</For>
          </g>
          <For each={ticks()}>
            {(t) => (
              <text class="chart__tick" x={x()(t)} y={TOP - 12} text-anchor="middle">
                {(props.tick ?? props.format)(t)}
              </text>
            )}
          </For>
          <text class="chart__axis-title" x={labelW() + 10} y={9} dominant-baseline="middle">
            {props.axisLabel}
          </text>
          <For each={props.rows}>
            {(r, i) => (
              <>
                <Show when={i() % 2 === 0}>
                  <rect class="cmp-dot__band" x={0} y={TOP + i() * ROW_H} width={W()} height={ROW_H} rx={8} />
                </Show>
                <text class="cmp-dot__label" x={labelW()} y={rowY(i()) + 4} text-anchor="end">
                  {r.label}
                </text>
              </>
            )}
          </For>
          <For each={spreads()}>
            {(s) => (
              <Show when={s}>
                {(sp) => <line class="cmp-dot__spread" x1={sp().x1} x2={sp().x2} y1={sp().y} y2={sp().y} />}
              </Show>
            )}
          </For>
          <For each={marks()}>{(m) => <MarkerShape i={m.s.i} x={m.cx} y={m.cy} scale={1.2} class="cmp-dot__mark" />}</For>
        </svg>
        <Show when={hover()}>
          {(h) => (
            <div class={`chart__tooltip${h().y < 70 ? " is-below" : ""}`} style={{ left: `${h().x}px`, top: `${h().y}px` }}>
              <div class="chart__tooltip-title">
                <i>{h().s.label}</i>
              </div>
              <div class="chart__tooltip-vals">
                <span>{h().row}</span>
                <span>{props.format(h().v)}</span>
              </div>
            </div>
          )}
        </Show>
      </div>
      <details class="cmp-details">
        <summary>Show the numbers</summary>
        <div class="cmp-scroll">
          <table class="cmp-table cmp-table--compact">
            <caption class="visually-hidden">{props.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{props.axisLabel}</th>
                <For each={props.series}>
                  {(s) => (
                    <th scope="col">
                      <span class="cmp-th">
                        <Marker i={s.i} size={14} />
                        <i>{s.label}</i>
                      </span>
                    </th>
                  )}
                </For>
              </tr>
            </thead>
            <tbody>
              <For each={props.rows}>
                {(r) => (
                  <tr>
                    <th scope="row">{r.href ? <a href={r.href}>{r.label}</a> : r.label}</th>
                    <For each={props.series}>
                      {(s) => {
                        const v = props.values[r.key]?.[s.id];
                        return <td>{v === null || v === undefined ? "–" : props.format(v)}</td>;
                      }}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
