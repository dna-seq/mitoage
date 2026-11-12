/**
 * Reusable scatter plot island (SVG, d3 scales, Solid rendering).
 *
 * Features: log or linear x axis; colour by group (CSS colours, so themes work); a highlighted
 * point with halo and label; labelled key points; hover/tap tooltip via nearest-point search
 * (tap once to inspect, tap again to open); keyboard navigation (focus the plot, arrows move
 * between points by x, Enter opens, Esc clears); legend buttons that spotlight a group.
 *
 * Data: pass `points` inline (rendered on the server too) and/or `dataUrl` pointing at a
 * ScatterPayload JSON (fetched when the island mounts; use client:visible). Points from both
 * are merged by id.
 *
 * <Scatter client:visible points={pts} groups={CLASS_GROUPS} xLog xLabel="Maximum lifespan"
 *          yLabel="GC %" xFormat="lifespan" yFormat="percent" labelIds={["homo-sapiens"]}
 *          ariaLabel="..." />
 */
import { Delaunay } from "d3-delaunay";
import { scaleLinear, scaleLog } from "d3-scale";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { fmtLifespan, fmtNum, fmtPct } from "~/lib/format";
import { payloadToPoints, type ScatterGroup, type ScatterPayload, type ScatterPoint } from "~/lib/scatterTypes";

export type AxisFormat = "lifespan" | "percent" | "number" | "integer";

export interface ScatterProps {
  points?: ScatterPoint[];
  dataUrl?: string;
  groups: ScatterGroup[];
  xLabel: string;
  yLabel: string;
  xLog?: boolean;
  yLog?: boolean;
  xFormat?: AxisFormat;
  yFormat?: AxisFormat;
  /** Fixed domains (recommended with dataUrl so the axes render before data arrives). */
  xDomain?: [number, number];
  yDomain?: [number, number];
  highlightId?: string;
  labelIds?: string[];
  /** Colour only this group; draw the rest in the muted colour. */
  emphasizeGroup?: string;
  /** Legend entries override (e.g. "This species / Other mammals / Other classes"). */
  legend?: { label: string; color: string; group?: string }[];
  /** Let legend buttons spotlight a group. */
  interactiveLegend?: boolean;
  ariaLabel: string;
  /** viewBox height; width is 640. */
  height?: number;
  note?: string;
}

const W = 640;
const M = { top: 16, right: 18, bottom: 46, left: 50 };

const fmt = (f: AxisFormat | undefined, v: number): string => {
  switch (f) {
    case "lifespan":
      return fmtLifespan(v);
    case "percent":
      return fmtPct(v, 1);
    case "integer":
      return fmtNum(v, 0);
    default:
      return fmtNum(v, 2);
  }
};

const tickFmt = (f: AxisFormat | undefined, v: number): string => {
  if (f === "lifespan") return v < 1 ? `${fmtNum(v, 2)} yr` : `${fmtNum(v, 0)} yr`;
  if (f === "percent") return fmtNum(v, 1);
  return fmtNum(v, 2);
};

const decadeTicks = (lo: number, hi: number): number[] => {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    const v = 10 ** e;
    if (v >= lo && v <= hi) out.push(v);
  }
  return out;
};

const extent = (vals: number[], log: boolean): [number, number] => {
  const ok = vals.filter((v) => Number.isFinite(v) && (!log || v > 0));
  if (!ok.length) return log ? [1, 10] : [0, 1];
  const lo = Math.min(...ok);
  const hi = Math.max(...ok);
  if (log) return [lo / 1.35, hi * 1.35];
  const pad = (hi - lo || 1) * 0.06;
  return [lo - pad, hi + pad];
};

export default function Scatter(props: ScatterProps) {
  const H = () => props.height ?? 360;
  const [remote, setRemote] = createSignal<ScatterPoint[]>([]);
  const [loading, setLoading] = createSignal(Boolean(props.dataUrl));
  const [failed, setFailed] = createSignal(false);
  const [hover, setHover] = createSignal<ScatterPoint | null>(null);
  const [pinned, setPinned] = createSignal(false);
  const [spot, setSpot] = createSignal<string | null>(null);
  let svg: SVGSVGElement | undefined;

  onMount(() => {
    if (!props.dataUrl) return;
    fetch(props.dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<ScatterPayload>;
      })
      .then((p) => setRemote(payloadToPoints(p)))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  });

  const all = createMemo<ScatterPoint[]>(() => {
    const inline = props.points ?? [];
    if (!remote().length) return inline;
    const byId = new Map(remote().map((p) => [p.id, p] as const));
    for (const p of inline) byId.set(p.id, { ...byId.get(p.id), ...p });
    return [...byId.values()];
  });

  const valid = createMemo(() =>
    all().filter(
      (p) =>
        Number.isFinite(p.x) && Number.isFinite(p.y) && (!props.xLog || p.x > 0) && (!props.yLog || p.y > 0),
    ),
  );

  const xDom = createMemo(() => props.xDomain ?? extent(valid().map((p) => p.x), Boolean(props.xLog)));
  const yDom = createMemo(() => props.yDomain ?? extent(valid().map((p) => p.y), Boolean(props.yLog)));
  const x = createMemo(() => {
    const r: [number, number] = [M.left, W - M.right];
    return props.xLog ? scaleLog().domain(xDom()).range(r) : scaleLinear().domain(xDom()).range(r).nice();
  });
  const y = createMemo(() => {
    const r: [number, number] = [H() - M.bottom, M.top];
    return props.yLog ? scaleLog().domain(yDom()).range(r) : scaleLinear().domain(yDom()).range(r).nice();
  });
  const xTicks = createMemo(() => (props.xLog ? decadeTicks(xDom()[0], xDom()[1]) : x().ticks(6)));
  const yTicks = createMemo(() => (props.yLog ? decadeTicks(yDom()[0], yDom()[1]) : y().ticks(5)));

  const colorOf = createMemo(() => {
    const m = new Map(props.groups.map((g) => [g.key, g.color] as const));
    return (g: string) => m.get(g) ?? "var(--chart-point-muted)";
  });

  const labelSet = createMemo(() => new Set(props.labelIds ?? []));
  // Draw order: muted first, then emphasised, then key points; highlight is drawn separately.
  const ordered = createMemo(() => {
    const em = props.emphasizeGroup;
    const rank = (p: ScatterPoint) => (labelSet().has(p.id) ? 2 : em && p.group !== em ? 0 : 1);
    return valid()
      .filter((p) => p.id !== props.highlightId)
      .sort((a, b) => rank(a) - rank(b));
  });
  const highlight = createMemo(() => valid().find((p) => p.id === props.highlightId));
  const byX = createMemo(() => [...valid()].sort((a, b) => a.x - b.x));

  const delaunay = createMemo(() => {
    const pts = valid();
    const xs = x();
    const ys = y();
    return Delaunay.from(
      pts,
      (p) => xs(p.x),
      (p) => ys(p.y),
    );
  });

  const toSvg = (clientX: number, clientY: number): [number, number] | null => {
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const k = W / r.width;
    return [(clientX - r.left) * k, (clientY - r.top) * k];
  };

  const nearest = (clientX: number, clientY: number, maxDist: number): ScatterPoint | null => {
    const pt = toSvg(clientX, clientY);
    const pts = valid();
    if (!pt || !pts.length) return null;
    const i = delaunay().find(pt[0], pt[1]);
    const p = pts[i];
    if (!p) return null;
    const d = Math.hypot(x()(p.x) - pt[0], y()(p.y) - pt[1]);
    return d <= maxDist ? p : null;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned()) return;
    setHover(nearest(e.clientX, e.clientY, 22));
  };
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !pinned()) setHover(null);
  };
  const onClick = (e: MouseEvent) => {
    const isTouch = (e as PointerEvent).pointerType === "touch" || (e as PointerEvent).pointerType === "pen";
    const p = nearest(e.clientX, e.clientY, isTouch ? 30 : 22);
    if (!p) {
      setHover(null);
      setPinned(false);
      return;
    }
    if (isTouch && hover()?.id !== p.id) {
      // First tap inspects, second tap on the same point opens it.
      setHover(p);
      setPinned(true);
      return;
    }
    if (p.href) window.location.assign(p.href);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const list = byX();
    if (!list.length) return;
    const cur = hover();
    const i = cur ? list.findIndex((p) => p.id === cur.id) : -1;
    const step = e.shiftKey ? 10 : 1;
    let next: ScatterPoint | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = list[Math.min(list.length - 1, i + step)];
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = list[Math.max(0, i < 0 ? 0 : i - step)];
    else if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    else if (e.key === "Enter" && cur?.href) {
      window.location.assign(cur.href);
      return;
    } else if (e.key === "Escape") {
      setHover(null);
      setPinned(false);
      return;
    } else return;
    e.preventDefault();
    if (next) {
      setHover(next);
      setPinned(true);
    }
  };

  const tip = createMemo(() => {
    const p = hover();
    if (!p || !svg) return null;
    const r = svg.getBoundingClientRect();
    const k = r.width / W;
    const px = x()(p.x) * k;
    const py = y()(p.y) * k;
    const left = Math.min(Math.max(px, 90), r.width - 90);
    return { p, left, top: py, below: py < 90 };
  });

  const labelFor = (p: ScatterPoint) => p.short ?? p.label;
  const labelPos = (p: ScatterPoint, big: boolean) => {
    const px = x()(p.x);
    const right = px < W - 120;
    const anchor: "start" | "end" = right ? "start" : "end";
    return { x: px + (right ? (big ? 13 : 9) : big ? -13 : -9), y: y()(p.y) + 4, anchor };
  };

  const groupCounts = createMemo(() => {
    const m = new Map<string, number>();
    for (const p of valid()) m.set(p.group, (m.get(p.group) ?? 0) + 1);
    return m;
  });

  const legendItems = createMemo(() =>
    props.legend
      ? props.legend.map((l) => ({ key: l.group ?? l.label, label: l.label, color: l.color, group: l.group }))
      : props.groups
          .filter((g) => (groupCounts().get(g.key) ?? 0) > 0 || loading())
          .map((g) => ({ key: g.key, label: g.label, color: g.color, group: g.key as string | undefined })),
  );

  const pointClass = (p: ScatterPoint) => {
    const classes = ["chart__point"];
    if (props.emphasizeGroup && p.group !== props.emphasizeGroup) classes.push("is-muted");
    if (spot() && p.group !== spot()) classes.push("is-dimmed");
    if (labelSet().has(p.id)) classes.push("is-key");
    return classes.join(" ");
  };

  const pointFill = (p: ScatterPoint) =>
    props.emphasizeGroup && p.group !== props.emphasizeGroup ? undefined : colorOf()(p.group);

  return (
    <figure class="chart">
      <div class="chart__frame">
        <svg
          ref={svg}
          class="chart__svg"
          viewBox={`0 0 ${W} ${H()}`}
          role="application"
          aria-roledescription="scatter plot"
          aria-label={`${props.ariaLabel}. Use arrow keys to move between points, Enter to open.`}
          tabIndex={0}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setPinned(false);
            setHover(null);
          }}
        >
          <g class="chart__grid">
            <For each={yTicks()}>{(t) => <line x1={M.left} x2={W - M.right} y1={y()(t)} y2={y()(t)} />}</For>
            <For each={xTicks()}>{(t) => <line y1={M.top} y2={H() - M.bottom} x1={x()(t)} x2={x()(t)} />}</For>
          </g>
          <path class="chart__axis-line" d={`M${M.left} ${M.top}V${H() - M.bottom}H${W - M.right}`} />
          <g>
            <For each={yTicks()}>
              {(t) => (
                <text class="chart__tick" x={M.left - 8} y={y()(t) + 4} text-anchor="end">
                  {tickFmt(props.yFormat, t)}
                </text>
              )}
            </For>
            <For each={xTicks()}>
              {(t) => (
                <text class="chart__tick" x={x()(t)} y={H() - M.bottom + 19} text-anchor="middle">
                  {tickFmt(props.xFormat, t)}
                </text>
              )}
            </For>
            <text class="chart__axis-title" x={(M.left + W - M.right) / 2} y={H() - 6} text-anchor="middle">
              {props.xLabel}
            </text>
            <text class="chart__axis-title" x={M.left + 6} y={M.top + 2} dominant-baseline="hanging">
              {props.yLabel}
            </text>
          </g>
          <g>
            <For each={ordered()}>
              {(p) => (
                <circle
                  class={pointClass(p)}
                  cx={x()(p.x)}
                  cy={y()(p.y)}
                  r={labelSet().has(p.id) ? 6 : 4.2}
                  style={pointFill(p) ? { fill: pointFill(p) } : undefined}
                />
              )}
            </For>
          </g>
          <Show when={highlight()}>
            {(h) => (
              <g>
                <circle class="chart__halo" cx={x()(h().x)} cy={y()(h().y)} r={17} />
                <circle class="chart__highlight" cx={x()(h().x)} cy={y()(h().y)} r={8.5} />
              </g>
            )}
          </Show>
          <g>
            <For each={ordered().filter((p) => labelSet().has(p.id))}>
              {(p) => {
                const l = labelPos(p, false);
                return (
                  <text class="chart__label" x={l.x} y={l.y} text-anchor={l.anchor}>
                    {labelFor(p)}
                  </text>
                );
              }}
            </For>
            <Show when={highlight()}>
              {(h) => {
                const l = () => labelPos(h(), true);
                return (
                  <text class="chart__label chart__label--hl" x={l().x} y={l().y} text-anchor={l().anchor}>
                    {labelFor(h())}
                  </text>
                );
              }}
            </Show>
          </g>
          <Show when={hover()}>
            {(p) => <circle class="chart__hover-ring" cx={x()(p().x)} cy={y()(p().y)} r={9} />}
          </Show>
        </svg>
        <Show when={loading() && !valid().length}>
          <div class="chart__loading">Loading species…</div>
        </Show>
        <Show when={tip()}>
          {(t) => (
            <div
              class={`chart__tooltip${t().below ? " is-below" : ""}`}
              style={{ left: `${t().left}px`, top: `${t().top}px` }}
              aria-hidden="true"
            >
              <div class="chart__tooltip-title">
                <i>{t().p.label}</i>
              </div>
              <Show when={t().p.sub}>
                <div class="chart__tooltip-sub">{t().p.sub}</div>
              </Show>
              <div class="chart__tooltip-vals">
                <span>{fmt(props.xFormat, t().p.x)}</span>
                <span>{fmt(props.yFormat, t().p.y)}</span>
              </div>
              <Show when={t().p.href && pinned()}>
                <div class="chart__tooltip-hint">Tap again to open</div>
              </Show>
            </div>
          )}
        </Show>
        <div class="visually-hidden" aria-live="polite">
          {hover() ? `${hover()?.label}: ${fmt(props.xFormat, hover()?.x ?? 0)}, ${fmt(props.yFormat, hover()?.y ?? 0)}` : ""}
        </div>
      </div>
      <figcaption class="stack" style={{ "--stack-gap": "var(--space-2)" }}>
        <ul class="chart__legend">
          <For each={legendItems()}>
            {(l) =>
              props.interactiveLegend && l.group ? (
                <li>
                  <button
                    type="button"
                    class="chart__legend-btn"
                    aria-pressed={spot() === l.group}
                    onClick={() => setSpot((s) => (s === l.group ? null : (l.group ?? null)))}
                  >
                    <span class="chart__legend-swatch" style={{ "--swatch": l.color }} />
                    {l.label}
                    <span class="chart__legend-count">{groupCounts().get(l.group) ?? ""}</span>
                  </button>
                </li>
              ) : (
                <li>
                  <span class="chart__legend-btn">
                    <span class="chart__legend-swatch" style={{ "--swatch": l.color }} />
                    {l.label}
                  </span>
                </li>
              )
            }
          </For>
        </ul>
        <Show when={failed()}>
          <p class="chart__note">The full species set could not be loaded.</p>
        </Show>
        <Show when={props.note}>
          <p class="chart__note">{props.note}</p>
        </Show>
      </figcaption>
    </figure>
  );
}
