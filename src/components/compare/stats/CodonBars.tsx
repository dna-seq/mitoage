/**
 * Codon usage of a group as stacked rows: one row per amino acid (vertebrate mitochondrial code),
 * its codons as segments coloured by their third base. The row's length is the amino acid's share
 * of all codons, or every row fills the width to compare the choice between synonymous codons.
 * Hover or tap a segment for its numbers; the table below has all of them. Data: codonBarRows()
 * in ~/lib/compare/charts.
 */
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { CodonBarRow, CodonSeg } from "~/lib/compare/charts";
import { fmtFixed, fmtInt } from "~/lib/format";

export type CodonScale = "usage" | "share";

export interface CodonBarsProps {
  rows: CodonBarRow[];
  scale: CodonScale;
  onScale: (s: CodonScale) => void;
  /** "all 13 protein-coding genes", "ND6". */
  what: string;
}

const BASES = [
  { key: "a", label: "A" },
  { key: "t", label: "U (T)" },
  { key: "g", label: "G" },
  { key: "c", label: "C" },
] as const;

/** A segment narrower than this many pixels does not get its codon written on it. */
const MIN_LABEL_PX = 36;

export default function CodonBars(props: CodonBarsProps) {
  const [active, setActive] = createSignal<{ row: CodonBarRow; seg: CodonSeg } | null>(null);
  const [trackW, setTrackW] = createSignal(480);
  let list: HTMLUListElement | undefined;

  onMount(() => {
    if (!list || !("ResizeObserver" in window)) return;
    const measure = () => {
      const w = list?.querySelector<HTMLElement>(".cbar__track")?.clientWidth;
      if (w) setTrackW(w);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    measure();
    onCleanup(() => ro.disconnect());
  });

  const max = createMemo(() => Math.max(0, ...props.rows.map((r) => r.total)));
  const barShare = (r: CodonBarRow) => (props.scale === "share" ? 1 : max() > 0 ? r.total / max() : 0);
  const labelled = (r: CodonBarRow, s: CodonSeg) => trackW() * barShare(r) * s.share >= MIN_LABEL_PX;
  const title = (r: CodonBarRow, s: CodonSeg) =>
    `${s.codon} (${s.dna}), ${r.name}: ${fmtFixed(s.mean, 2)}% of codons, ${fmtFixed(s.share * 100, 1)}% of ${r.aa}`;

  return (
    <figure class="cbar">
      <div class="cs-controls">
        <div class="seg" role="group" aria-label="Length of the bars">
          <button type="button" class="seg__btn" aria-pressed={props.scale === "usage"} onClick={() => props.onScale("usage")}>
            Share of all codons
          </button>
          <button type="button" class="seg__btn" aria-pressed={props.scale === "share"} onClick={() => props.onScale("share")}>
            Within each amino acid
          </button>
        </div>
      </div>
      <ul
        class="cbar__rows"
        role="list"
        ref={list}
        aria-label={`Codon usage by amino acid in ${props.what}; the numbers are in the table below`}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
      >
        <For each={props.rows}>
          {(r) => (
            <li class="cbar__row">
              <span class="cbar__aa" title={r.name}>
                {r.aa}
              </span>
              <div class="cbar__track">
                <div class="cbar__bar" style={{ width: `${(barShare(r) * 100).toFixed(2)}%` }}>
                  <For each={r.segs}>
                    {(s) => (
                      <span
                        class={`cbar__seg nt-${s.third}${active()?.seg === s ? " is-active" : ""}`}
                        style={{ "flex-grow": String(Math.max(1, Math.round(s.share * 10000))) }}
                        title={title(r, s)}
                        onPointerEnter={() => setActive({ row: r, seg: s })}
                        onPointerDown={() => setActive({ row: r, seg: s })}
                      >
                        <Show when={labelled(r, s)}>{s.codon}</Show>
                      </span>
                    )}
                  </For>
                </div>
              </div>
              <span class="cbar__total">{fmtFixed(r.total, 2)}%</span>
            </li>
          )}
        </For>
      </ul>
      <p class="cmap__detail" aria-live="polite">
        <Show when={active()} fallback="Hover or tap a segment for its codon.">
          {(a) => (
            <>
              <b>
                {a().seg.codon} ({a().seg.dna}) · {a().row.name}
              </b>
              <span>mean {fmtFixed(a().seg.mean, 2)}% of codons</span>
              <Show when={a().seg.sd !== null}>
                <span>SD {fmtFixed(a().seg.sd, 2)}</span>
              </Show>
              <Show when={a().seg.min !== null && a().seg.max !== null}>
                <span>
                  range {fmtFixed(a().seg.min, 2)} to {fmtFixed(a().seg.max, 2)}%
                </span>
              </Show>
              <span>
                {fmtFixed(a().seg.share * 100, 1)}% of {a().row.aa}
              </span>
              <span>{fmtInt(a().seg.n)} species</span>
            </>
          )}
        </Show>
      </p>
      <figcaption class="stack" style={{ "--stack-gap": "var(--space-2)" }}>
        <ul class="chart__legend rp__key">
          <li>
            <span class="chart__legend-btn cbar__legend-title">Third base</span>
          </li>
          <For each={BASES}>
            {(b) => (
              <li>
                <span class="chart__legend-btn">
                  <span class="chart__legend-swatch" style={{ "--swatch": `var(--nt-${b.key})` }} />
                  {b.label}
                </span>
              </li>
            )}
          </For>
        </ul>
        <p class="chart__note">
          One row per amino acid under the vertebrate mitochondrial code, most used first; the number is the mean share
          of all codons, summed over the amino acid's codons.{" "}
          {props.scale === "share"
            ? "Each row fills the width: a segment is the codon's share of the amino acid's mean usage (a ratio of means, not a mean of per-species ratios)."
            : "A segment's length is the codon's mean share of all codons."}
        </p>
      </figcaption>
    </figure>
  );
}
