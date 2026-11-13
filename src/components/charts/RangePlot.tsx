/**
 * Range chart (SVG, d3 scales, Solid rendering): one row per item, one value axis on top. A row
 * can carry a thin line (a range, or a confidence interval), a thick bar (mean ± SD, or zero to a
 * value), a tick (the median) and a dot (the mean, or r); whatever is null is not drawn. Hover or
 * tap a row for its numbers. The marks and the axis come from ~/lib/compare/charts, built from
 * the rows of the table the chart sits with, so the exact numbers are always in that table.
 *
 * <RangePlot marks={marks} axis={axis} glyphs={[{ kind: "dot", label: "mean" }]} ariaLabel="..." />
 */
import { scaleLinear, scaleLog } from "d3-scale";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { RangeAxis, RangeMark, Swatch } from "~/lib/compare/charts";
import { fmtInt } from "~/lib/format";
import { uiScale } from "~/lib/uiScale";

export type GlyphKind = "line" | "box" | "tick" | "dot" | "bar";

export interface RangePlotProps {
  marks: RangeMark[];
  axis: RangeAxis;
  ariaLabel: string;
  /** The marks the key under the chart explains, e.g. { kind: "box", label: "mean ± SD" }. */
  glyphs: { kind: GlyphKind; label: string }[];
  /** Colour key. */
  swatches?: Swatch[] | undefined;
  /** Show the number of species at the end of each row (wide charts only). */
  showN?: boolean | undefined;
  note?: string | undefined;
}

const DEFAULT_W = 640;
const ROW_H = 30;
const TOP = 46;
const BOTTOM = 8;
const CHAR_W = 7.5;

/** Log-axis ticks: 1-2-5 steps inside the domain, thinned to at most `max`. */
const logTicks = (lo: number, hi: number, max: number): number[] => {
  for (const mults of [[1, 2, 5], [1, 3], [1]]) {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
      for (const m of mults) {
        const v = Number((m * 10 ** e).toPrecision(12));
        if (v >= lo && v <= hi) out.push(v);
      }
    }
    if (out.length <= max) return out;
  }
  return [];
};

const Glyph = (p: { kind: GlyphKind }) => (
  <svg class="rp__glyph" width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
    {p.kind === "line" && (
      <>
        <line class="rp__line" x1="3" x2="27" y1="8" y2="8" />
        <line class="rp__line" x1="3" x2="3" y1="4" y2="12" />
        <line class="rp__line" x1="27" x2="27" y1="4" y2="12" />
      </>
    )}
    {p.kind === "box" && <rect class="rp__box" x="3" y="2" width="24" height="12" rx="6" />}
    {p.kind === "bar" && <rect class="rp__bar" x="3" y="2" width="24" height="12" rx="4" />}
    {p.kind === "tick" && <line class="rp__tick" x1="15" x2="15" y1="1" y2="15" />}
    {p.kind === "dot" && <circle class="rp__dot" cx="15" cy="8" r="5.5" />}
  </svg>
);

export default function RangePlot(props: RangePlotProps) {
  // The viewBox follows the rendered width, so text and marks keep their size on phones.
  const [W, setW] = createSignal(DEFAULT_W);
  const [hover, setHover] = createSignal<number | null>(null);
  let frame: HTMLDivElement | undefined;
  let svg: SVGSVGElement | undefined;

  onMount(() => {
    if (frame && "ResizeObserver" in window) {
      const ro = new ResizeObserver((e) => {
        const w = e[0]?.contentRect.width ?? DEFAULT_W;
        if (w > 0) setW(Math.round(Math.max(260, Math.min(1100, w / uiScale()))));
      });
      ro.observe(frame);
      onCleanup(() => ro.disconnect());
    }
  });

  const narrow = () => W() < 440;
  const labelW = createMemo(() => {
    const longest = Math.max(0, ...props.marks.map((m) => m.label.length));
    return Math.min(narrow() ? 104 : 190, Math.max(56, Math.ceil(longest * CHAR_W) + 6));
  });
  const fitLabel = (s: string) => {
    const max = Math.floor(labelW() / CHAR_W);
    return s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;
  };
  const withN = () => Boolean(props.showN) && W() >= 520;
  const x0 = () => labelW() + 12;
  const x1 = () => W() - (withN() ? 58 : 16);
  const H = () => TOP + props.marks.length * ROW_H + BOTTOM;
  const rowY = (i: number) => TOP + i * ROW_H + ROW_H / 2;

  const scale = createMemo(() => {
    const a = props.axis;
    const range: [number, number] = [x0(), x1()];
    return a.log ? scaleLog().domain(a.domain).range(range) : scaleLinear().domain(a.domain).range(range).nice();
  });
  const ticks = createMemo(() => {
    const a = props.axis;
    const max = narrow() ? 4 : 7;
    return a.log ? logTicks(a.domain[0], a.domain[1], max) : scale().ticks(max);
  });
  /** Screen x of a value, kept inside the plot (a bar that starts below a log axis is cut at its edge). */
  const px = (v: number): number => {
    const s = props.axis.log && v <= 0 ? x0() : scale()(v);
    return Math.max(x0(), Math.min(x1(), Number.isFinite(s) ? s : x0()));
  };
  const zeroX = createMemo(() => {
    const [lo, hi] = scale().domain() as [number, number];
    return props.axis.zero && !props.axis.log && lo <= 0 && hi >= 0 ? scale()(0) : null;
  });

  const rowAt = (clientY: number): number | null => {
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const y = (clientY - r.top) * (H() / r.height);
    const i = Math.floor((y - TOP) / ROW_H);
    return i >= 0 && i < props.marks.length ? i : null;
  };

  const tip = createMemo(() => {
    const i = hover();
    const m = i === null ? undefined : props.marks[i];
    if (i === null || !m || !svg) return null;
    const r = svg.getBoundingClientRect();
    const k = r.width / W();
    const at =
      m.dot !== null
        ? px(m.dot)
        : m.boxLo !== null && m.boxHi !== null
          ? (px(m.boxLo) + px(m.boxHi)) / 2
          : (x0() + x1()) / 2;
    const half = Math.min(120, r.width * 0.35);
    return {
      m,
      left: Math.min(Math.max(at * k, half), r.width - half),
      top: (rowY(i) - ROW_H / 2) * k,
      below: i < 3,
      bottom: (rowY(i) + ROW_H / 2) * k,
    };
  });

  return (
    <figure class="chart rp">
      <div class="chart__frame" ref={frame}>
        <svg
          ref={svg}
          class="chart__svg"
          viewBox={`0 0 ${W()} ${H()}`}
          role="img"
          aria-label={props.ariaLabel}
          onPointerMove={(e) => setHover(rowAt(e.clientY))}
          onPointerDown={(e) => setHover(rowAt(e.clientY))}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setHover(null);
          }}
        >
          <For each={props.marks}>
            {(_, i) => (
              <rect
                class={`rp__band${i() % 2 === 0 ? " is-even" : ""}${hover() === i() ? " is-hover" : ""}`}
                x={0}
                y={TOP + i() * ROW_H}
                width={W()}
                height={ROW_H}
                rx={8}
              />
            )}
          </For>
          <g class="chart__grid">
            <For each={ticks()}>{(t) => <line x1={scale()(t)} x2={scale()(t)} y1={TOP - 6} y2={H() - BOTTOM} />}</For>
          </g>
          <For each={ticks()}>
            {(t) => (
              <text class="chart__tick" x={scale()(t)} y={TOP - 11} text-anchor="middle">
                {props.axis.tick(t)}
              </text>
            )}
          </For>
          <text class="chart__axis-title" x={narrow() ? 0 : x0()} y={10} dominant-baseline="middle">
            {props.axis.label}
          </text>
          <Show when={withN()}>
            <text class="chart__axis-title" x={W() - 4} y={10} dominant-baseline="middle" text-anchor="end">
              species
            </text>
          </Show>
          <Show when={zeroX()}>{(z) => <line class="rp__zero" x1={z()} x2={z()} y1={TOP - 6} y2={H() - BOTTOM} />}</Show>
          <For each={props.marks}>
            {(m, i) => {
              const cy = () => rowY(i());
              const bar = () => m.dot === null && m.lo === null;
              return (
                <g style={{ "--rp": m.color }}>
                  <Show
                    when={m.href}
                    fallback={
                      <text class="rp__label" x={labelW()} y={cy() + 4.5} text-anchor="end">
                        {fitLabel(m.label)}
                      </text>
                    }
                  >
                    {/* The <g> makes Solid build this template as SVG: a bare <a> would be an HTML link. */}
                    <g>
                      <a href={m.href ?? undefined} class="rp__link">
                        <text class="rp__label" x={labelW()} y={cy() + 4.5} text-anchor="end">
                          {fitLabel(m.label)}
                        </text>
                      </a>
                    </g>
                  </Show>
                  <Show when={m.empty}>
                    <text class="rp__empty" x={x0() + 6} y={cy() + 4.5}>
                      {m.empty}
                    </text>
                  </Show>
                  <Show when={m.lo !== null && m.hi !== null}>
                    <line class="rp__line" x1={px(m.lo ?? 0)} x2={px(m.hi ?? 0)} y1={cy()} y2={cy()} />
                    <line class="rp__line" x1={px(m.lo ?? 0)} x2={px(m.lo ?? 0)} y1={cy() - 5} y2={cy() + 5} />
                    <line class="rp__line" x1={px(m.hi ?? 0)} x2={px(m.hi ?? 0)} y1={cy() - 5} y2={cy() + 5} />
                  </Show>
                  <Show when={m.boxLo !== null && m.boxHi !== null}>
                    <rect
                      class={bar() ? "rp__bar" : "rp__box"}
                      x={Math.min(px(m.boxLo ?? 0), px(m.boxHi ?? 0))}
                      y={cy() - 7}
                      width={Math.max(bar() ? 2 : 0, Math.abs(px(m.boxHi ?? 0) - px(m.boxLo ?? 0)))}
                      height={14}
                      rx={bar() ? 4 : 7}
                    />
                  </Show>
                  <Show when={m.tick !== null}>
                    <line class="rp__tick" x1={px(m.tick ?? 0)} x2={px(m.tick ?? 0)} y1={cy() - 9} y2={cy() + 9} />
                  </Show>
                  <Show when={m.dot !== null}>
                    <circle class="rp__dot" cx={px(m.dot ?? 0)} cy={cy()} r={5.5} />
                  </Show>
                  <Show when={withN()}>
                    <text class="rp__n" x={W() - 4} y={cy() + 4.5} text-anchor="end">
                      {fmtInt(m.n)}
                    </text>
                  </Show>
                </g>
              );
            }}
          </For>
        </svg>
        <Show when={tip()}>
          {(t) => (
            <div
              class={`chart__tooltip${t().below ? " is-below" : ""}`}
              style={{ left: `${t().left}px`, top: `${t().below ? t().bottom : t().top}px` }}
              aria-hidden="true"
            >
              <div class="chart__tooltip-title">{t().m.label}</div>
              <Show when={t().m.empty}>
                <div class="chart__tooltip-sub">{t().m.empty}</div>
              </Show>
              <dl class="rp__tip">
                <For each={t().m.tip}>
                  {([name, value]) => (
                    <>
                      <dt>{name}</dt>
                      <dd>{value}</dd>
                    </>
                  )}
                </For>
              </dl>
            </div>
          )}
        </Show>
      </div>
      <figcaption class="stack" style={{ "--stack-gap": "var(--space-2)" }}>
        <ul class="chart__legend rp__key">
          <For each={props.glyphs}>
            {(g) => (
              <li>
                <span class="chart__legend-btn">
                  <Glyph kind={g.kind} />
                  {g.label}
                </span>
              </li>
            )}
          </For>
          <For each={props.swatches ?? []}>
            {(s) => (
              <li>
                <span class="chart__legend-btn">
                  <span class="chart__legend-swatch" style={{ "--swatch": s.color }} />
                  {s.label}
                </span>
              </li>
            )}
          </For>
        </ul>
        <Show when={props.note}>
          <p class="chart__note">{props.note}</p>
        </Show>
      </figcaption>
    </figure>
  );
}
