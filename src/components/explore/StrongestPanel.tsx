/**
 * "Strongest correlations": the precomputed features most correlated with a trait in a scope,
 * with Benjamini-Hochberg q and phylogenetic (PIC) r. Selecting a row plots it.
 */
import { createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
import type { TraitKey } from "~/data/schema";
import { classLabel } from "~/lib/classes";
import { fmtInt } from "~/lib/format";
import { loadCorr } from "~/lib/explore/client";
import { fmtP, fmtR } from "~/lib/explore/format";
import { getVariable, GROUP_LABEL, regionPickerLabel, type VarGroup } from "~/lib/explore/variables";
import { type CorrIndex, corrRow, type CorrRow, scopeParts } from "~/lib/explore/wire";

interface Props {
  index: CorrIndex;
  onPick: (trait: TraitKey, feature: string, scope: string) => void;
}

type Kind = "all" | Exclude<VarGroup, "trait">;
const KINDS: { k: Kind; label: string }[] = [
  { k: "all", label: "All" },
  { k: "composition", label: "Size and GC" },
  { k: "codon", label: "Codons" },
  { k: "aminoAcid", label: "Amino acids" },
];
const PAGE = 15;

export const scopeOptionLabel = (scope: string): string => {
  const { rank, name } = scopeParts(scope);
  if (rank === "class") return `${classLabel(name)} (${name})`;
  if (rank === "order") return name;
  return "All species";
};

export default function StrongestPanel(props: Props) {
  const [trait, setTrait] = createSignal<TraitKey>("maxLongevityYears");
  const [scope, setScope] = createSignal("all");
  const [kind, setKind] = createSignal<Kind>("all");
  const [rankBy, setRankBy] = createSignal<"rho" | "pic">("rho");
  const [onlySig, setOnlySig] = createSignal(false);
  const [limit, setLimit] = createSignal(PAGE);

  const ti = () => props.index.traits.indexOf(trait());
  const rowsFor = (s: string) => props.index.rows[ti()]?.[props.index.scopes.indexOf(s)] ?? 0;
  const scopes = createMemo(() => props.index.scopes.filter((s) => rowsFor(s) > 0));
  const effectiveScope = () => (rowsFor(scope()) > 0 ? scope() : "all");

  // The source stays false during server rendering, so nothing is fetched there.
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  const [data] = createResource(
    () => (mounted() ? { t: trait(), s: effectiveScope() } : false),
    ({ t, s }) => loadCorr(t, s),
  );

  const allRows = createMemo<CorrRow[]>(() => {
    const d = data.latest;
    if (!d) return [];
    return d.file.f.map((_, i) => corrRow(d.file, i));
  });

  const rows = createMemo(() => {
    const k = kind();
    let list = allRows().filter((r) => {
      if (k === "all") return true;
      return getVariable(r.feature)?.group === k;
    });
    if (onlySig()) list = list.filter((r) => r.q !== null && r.q < 0.05 && r.picP !== null && r.picP < 0.05);
    if (rankBy() === "pic") list = [...list].sort((a, b) => Math.abs(b.pic ?? 0) - Math.abs(a.pic ?? 0));
    return list;
  });

  const summary = createMemo(() => {
    const all = allRows();
    const sig = all.filter((r) => r.q !== null && r.q < 0.05);
    const both = sig.filter((r) => r.picP !== null && r.picP < 0.05);
    return { total: all.length, sig: sig.length, both: both.length };
  });

  const traitLabel = (t: TraitKey) => getVariable(t)?.label ?? t;
  const isLifespan = () => trait() === "maxLongevityYears";

  const featureText = (key: string) => {
    const v = getVariable(key);
    if (!v || v.kind !== "feature") return { main: key, sub: "" };
    return { main: v.label, sub: `${GROUP_LABEL[v.group]} · ${regionPickerLabel(v.region)}` };
  };

  /** Bars span ±(largest |rho| in this trait and scope, rounded up to 0.1), so differences stay visible. */
  const barScale = createMemo(() => {
    let m = 0;
    for (const r of allRows()) m = Math.max(m, Math.abs(r.rho ?? 0));
    return Math.max(0.3, Math.ceil(m * 10) / 10);
  });
  const bar = (r: number | null) => {
    const v = r ?? 0;
    const w = Math.min(1, Math.abs(v) / barScale()) * 50;
    return { left: v < 0 ? `${50 - w}%` : "50%", width: `${w}%` };
  };

  return (
    <section class="card xp-strong" aria-labelledby="xp-strong-title" id="strongest">
      <div class="card__head">
        <div>
          <span class="eyebrow">Precomputed for every feature</span>
          <h2 class="card__title" id="xp-strong-title">
            Strongest correlations
          </h2>
        </div>
        <p class="card__desc xp-strong__lede">
          Rank all 1,257 mtDNA features by how strongly they track a trait. Select a row to plot it.
        </p>
      </div>

      <div class="xp-strong__controls">
        <label class="field">
          Trait
          <select
            class="select"
            onChange={(e) => {
              setTrait(e.currentTarget.value as TraitKey);
              setLimit(PAGE);
            }}
          >
            <For each={props.index.traits}>
              {(t) => (
                <option value={t} selected={trait() === t}>
                  {traitLabel(t)}
                </option>
              )}
            </For>
          </select>
        </label>
        <label class="field">
          Species
          <select
            class="select"
            onChange={(e) => {
              setScope(e.currentTarget.value);
              setLimit(PAGE);
            }}
          >
            <option value="all" selected={effectiveScope() === "all"}>
              All species
            </option>
            <optgroup label="Classes">
              <For each={scopes().filter((s) => s.startsWith("class:"))}>
                {(s) => (
                  <option value={s} selected={effectiveScope() === s}>
                    {scopeOptionLabel(s)}
                  </option>
                )}
              </For>
            </optgroup>
            <optgroup label="Orders">
              <For each={scopes().filter((s) => s.startsWith("order:"))}>
                {(s) => (
                  <option value={s} selected={effectiveScope() === s}>
                    {scopeOptionLabel(s)}
                  </option>
                )}
              </For>
            </optgroup>
          </select>
        </label>
        <div class="field">
          <span id="xp-strong-kind">Features</span>
          <div class="seg" role="group" aria-labelledby="xp-strong-kind">
            <For each={KINDS}>
              {(k) => (
                <button type="button" class="seg__btn" aria-pressed={kind() === k.k} onClick={() => {
                  setKind(k.k);
                  setLimit(PAGE);
                }}>
                  {k.label}
                </button>
              )}
            </For>
          </div>
        </div>
        <div class="field">
          <span id="xp-strong-rank">Rank by</span>
          <div class="seg" role="group" aria-labelledby="xp-strong-rank">
            <button type="button" class="seg__btn" aria-pressed={rankBy() === "rho"} onClick={() => setRankBy("rho")}>
              Spearman ρ
            </button>
            <button type="button" class="seg__btn" aria-pressed={rankBy() === "pic"} onClick={() => setRankBy("pic")}>
              PIC r
            </button>
          </div>
        </div>
        <label class="xp-check">
          <input type="checkbox" checked={onlySig()} onChange={(e) => setOnlySig(e.currentTarget.checked)} />
          <span>Only q &lt; 0.05 and PIC p &lt; 0.05</span>
        </label>
      </div>

      <Show when={!data.error} fallback={<p class="empty">These correlations could not be loaded.</p>}>
        <p class="xp-strong__summary" aria-live="polite">
          <Show when={summary().total} fallback={<>Loading correlations…</>}>
            {traitLabel(trait())} in {effectiveScope() === "all" ? "all species" : scopeOptionLabel(effectiveScope())}:{" "}
            <strong>{fmtInt(summary().sig)}</strong> of {fmtInt(summary().total)} features have q &lt; 0.05;{" "}
            <strong>{fmtInt(summary().both)}</strong> of them also hold up after phylogenetic correction (PIC p &lt; 0.05).
          </Show>
        </p>

        <div class="xp-rows" classList={{ "is-loading": data.loading, "has-partial": isLifespan() }}>
          <div class="xp-rows__head" aria-hidden="true">
            <span>#</span>
            <span>Feature</span>
            <span>Spearman ρ</span>
            <span>q</span>
            <span>PIC r</span>
            <Show when={isLifespan()}>
              <span>Partial r</span>
            </Show>
          </div>
          <ol role="list" class="xp-rows__list">
            <For each={rows().slice(0, limit())}>
              {(r, i) => {
                const t = featureText(r.feature);
                const picSig = r.picP !== null && r.picP < 0.05;
                const partSig = r.partialP !== null && r.partialP < 0.05;
                return (
                  <li>
                    <button
                      type="button"
                      class="xp-row"
                      onClick={() => props.onPick(trait(), r.feature, effectiveScope())}
                    >
                      <span class="xp-row__rank">{i() + 1}</span>
                      <span class="xp-row__name">
                        {t.main}
                        <span class="xp-row__sub">
                          {t.sub} · n = {fmtInt(r.n)}
                        </span>
                      </span>
                      <span class="xp-row__rho">
                        <span class="xp-rho" aria-hidden="true">
                          <span
                            class={`xp-rho__bar ${(r.rho ?? 0) < 0 ? "is-neg" : "is-pos"}`}
                            style={bar(r.rho)}
                          />
                        </span>
                        <span class="xp-row__val">
                          <span class="xp-row__lbl">ρ </span>
                          {fmtR(r.rho, 2)}
                        </span>
                      </span>
                      <span class="xp-row__stats">
                        <span class="xp-row__q" classList={{ "is-weak": r.q === null || r.q >= 0.05 }}>
                          <span class="xp-row__lbl">q </span>
                          {fmtP(r.q)}
                        </span>
                        <span class="xp-row__pic" classList={{ "is-weak": !picSig }} title={`PIC p = ${fmtP(r.picP)}`}>
                          <span class="xp-row__lbl">PIC r </span>
                          {fmtR(r.pic, 2)}
                          <span class="visually-hidden">{picSig ? " (p < 0.05)" : " (not significant)"}</span>
                        </span>
                        <Show when={isLifespan()}>
                          <span class="xp-row__part" classList={{ "is-weak": !partSig }} title={`Partial p = ${fmtP(r.partialP)}`}>
                            <span class="xp-row__lbl">partial r </span>
                            {fmtR(r.partialR, 2)}
                          </span>
                        </Show>
                      </span>
                    </button>
                  </li>
                );
              }}
            </For>
          </ol>
          <Show when={!data.loading && rows().length === 0 && summary().total > 0}>
            <p class="empty">No feature passes both filters here.</p>
          </Show>
        </div>
        <Show when={rows().length > limit()}>
          <button type="button" class="btn btn--soft btn--sm xp-strong__more" onClick={() => setLimit((l) => l + PAGE * 2)}>
            Show more ({fmtInt(rows().length - limit())} left)
          </button>
        </Show>
      </Show>

      <details class="xp-caveats">
        <summary>How to read this table</summary>
        <ul>
          <li>
            <strong>q</strong> is the Benjamini–Hochberg false discovery rate across all features tested against this
            trait in this group. With 1,257 tests, some strong-looking ρ values appear by chance; q accounts for that.
          </li>
          <li>
            <strong>PIC r</strong> correlates changes along a dated tree (phylogenetically independent contrasts), so
            close relatives are not counted as independent evidence. Faded values have PIC p ≥ 0.05.
          </li>
          <li>
            <strong>Partial r</strong> (lifespan only) holds adult body mass constant, since big animals live longer
            and differ in many other ways.
          </li>
          <li>
            Traits are log10-transformed. "All species" pools fish, birds and mammals, which differ in both mtDNA and
            lifespan: check a single class before drawing conclusions. A correlation is not a cause.
          </li>
        </ul>
      </details>
    </section>
  );
}
