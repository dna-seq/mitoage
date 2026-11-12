/**
 * Series markers for the compare page: each compared species gets a colour AND a shape, so the
 * charts stay readable without colour vision and in print. Colours are --cmp-0 .. --cmp-5 from
 * compare.css (mapped to the site's tone tokens).
 */
import { Show } from "solid-js";

export const SERIES_COUNT = 6;
export const seriesColor = (i: number): string => `var(--cmp-${i % SERIES_COUNT})`;

/** SVG path of shape i centred on (0, 0), roughly 12 px across. Index 0 is a circle (no path). */
const SHAPES = [
  "",
  "M-5.5 -5.5H5.5V5.5H-5.5Z",
  "M0 -7.2L7.2 0L0 7.2L-7.2 0Z",
  "M0 -7L6.6 5H-6.6Z",
  "M0 7L6.6 -5H-6.6Z",
  "M-6.4 0L-3.2 -5.6H3.2L6.4 0L3.2 5.6H-3.2Z",
];

/** The shape as an SVG element positioned at (x, y); use inside an <svg>. */
export function MarkerShape(p: { i: number; x?: number; y?: number; scale?: number; class?: string }) {
  const tr = () => `translate(${p.x ?? 0} ${p.y ?? 0})${p.scale ? ` scale(${p.scale})` : ""}`;
  const d = () => SHAPES[p.i % SERIES_COUNT] ?? "";
  return (
    <Show
      when={d()}
      fallback={<circle class={p.class} transform={tr()} r={6} style={{ fill: seriesColor(p.i) }} />}
    >
      <path class={p.class} transform={tr()} d={d()} style={{ fill: seriesColor(p.i) }} />
    </Show>
  );
}

/** Stand-alone marker icon (legend, card headers). */
export function Marker(p: { i: number; size?: number; label?: string }) {
  const s = () => p.size ?? 18;
  return (
    <svg
      class="cmp-marker"
      width={s()}
      height={s()}
      viewBox="-9 -9 18 18"
      role={p.label ? "img" : undefined}
      aria-label={p.label}
      aria-hidden={p.label ? undefined : "true"}
    >
      <MarkerShape i={p.i} class="cmp-marker__shape" />
    </svg>
  );
}
