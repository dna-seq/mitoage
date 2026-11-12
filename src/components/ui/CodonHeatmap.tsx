/**
 * 64-codon usage heatmap grouped by amino acid, with a gene selector.
 * Counts arrive as compact arrays in CODONS order (see ~/lib/geneticCode).
 *
 * <CodonHeatmap client:visible code={2} sets={[{ region: "total_pc", label: "All protein-coding genes", counts: [...] }]} />
 */
import { createMemo, createSignal, createUniqueId, For, Show } from "solid-js";
import { fmtInt, fmtPct } from "~/lib/format";
import {
  AMINO_ACIDS,
  CODONS,
  ECHINODERM_MITO,
  groupCodons,
  INVERTEBRATE_MITO,
  VERTEBRATE_MITO,
} from "~/lib/geneticCode";

export interface CodonSet {
  region: string;
  label: string;
  /** 64 counts in CODONS order. */
  counts: number[];
}

interface Props {
  sets: CodonSet[];
  /** NCBI translation table id: 2, 5 or 9. */
  code: number;
}

export default function CodonHeatmap(props: Props) {
  const uid = createUniqueId();
  const [sel, setSel] = createSignal(props.sets[0]?.region ?? "");
  const code = () => (props.code === 5 ? INVERTEBRATE_MITO : props.code === 9 ? ECHINODERM_MITO : VERTEBRATE_MITO);
  const groups = createMemo(() => groupCodons(code()));
  const current = createMemo(() => props.sets.find((s) => s.region === sel()) ?? props.sets[0]);
  const countOf = createMemo(() => {
    const m = new Map<string, number>();
    const c = current();
    CODONS.forEach((cod, i) => m.set(cod, c?.counts[i] ?? 0));
    return m;
  });
  const total = createMemo(() => [...countOf().values()].reduce((a, b) => a + b, 0));
  const max = createMemo(() => Math.max(1, ...countOf().values()));

  return (
    <div class="heat">
      <div class="cluster" style={{ "justify-content": "space-between" }}>
        <Show when={props.sets.length > 1}>
          <label class="field" for={`heat-${uid}`}>
            Gene
            <select
              id={`heat-${uid}`}
              class="select"
              value={sel()}
              onChange={(e) => setSel(e.currentTarget.value)}
            >
              <For each={props.sets}>{(s) => <option value={s.region}>{s.label}</option>}</For>
            </select>
          </label>
        </Show>
        <div class="heat__scale" aria-hidden="true">
          <span>0</span>
          <span class="heat__ramp" />
          <span>{fmtInt(max())}</span>
        </div>
      </div>
      <p class="card__desc">
        {fmtInt(total())} codons in {current()?.label.toLowerCase()}. Grouped with the {code().name}.
      </p>
      <div class="heat__grid">
        <For each={groups()}>
          {(g) => {
            const aaTotal = () => g.codons.reduce((a, c) => a + (countOf().get(c) ?? 0), 0);
            const info = AMINO_ACIDS[g.aa];
            return (
              <section class="heat__aa" aria-label={`${info?.name ?? g.aa}: ${fmtInt(aaTotal())} codons`}>
                <div class="heat__aa-head">
                  <span>
                    {info?.three ?? g.aa} <span class="muted">{g.aa === "*" ? "" : g.aa}</span>
                  </span>
                  <small>{total() ? fmtPct((aaTotal() / total()) * 100, 1) : "–"}</small>
                </div>
                <div class="heat__cells">
                  <For each={g.codons}>
                    {(c) => {
                      const n = () => countOf().get(c) ?? 0;
                      const v = () => n() / max();
                      return (
                        <div
                          class={`heat__cell${v() > 0.5 ? " is-strong" : ""}`}
                          style={{ "--v": v().toFixed(3) }}
                          title={`${c}: ${fmtInt(n())}`}
                        >
                          <span class="heat__codon">{c}</span>
                          <span class="heat__count">{fmtInt(n())}</span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </section>
            );
          }}
        </For>
      </div>
    </div>
  );
}
