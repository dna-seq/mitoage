/**
 * Axis picker for the plot explorer: a trigger button plus a modal dialog (a bottom sheet on
 * phones) that makes some 1,400 variables usable. Type to filter across everything (arrow keys +
 * Enter), or browse by kind: life-history traits, a region x measure matrix for size and
 * composition, codon / amino-acid grids per protein-coding region, fourfold-site bases per region,
 * and a measure x region matrix for repeats and motifs.
 */
import { createEffect, createMemo, createSignal, createUniqueId, For, Show } from "solid-js";
import { ICONS } from "~/components/ui/icons";
import { fmtInt } from "~/lib/format";
import { AMINO_ACIDS, CODONS } from "~/lib/geneticCode";
import {
  AMINO_ACID_LETTERS,
  CODING_REGIONS,
  codonAminoAcid,
  CONTACT_KINDS,
  FOURFOLD_REGIONS,
  getCatalog,
  getVariable,
  GROUP_LABEL,
  type Measure,
  REGION_ORDER,
  regionPickerLabel,
  STRUCTURE_REGIONS,
  STRUCTURE_SPECS,
  type Variable,
  type VarGroup,
  variableContext,
  type VarRegion,
} from "~/lib/explore/variables";

interface Props {
  axis: "x" | "y";
  value: string;
  onChange: (key: string) => void;
  /** Species with a value, shown next to life-history traits once the data is loaded. */
  count?: ((key: string) => number | undefined) | undefined;
}

/** Picker tabs: one per group, except that protein hydropathy sits with the amino acids it is computed from. */
type Tab = Exclude<VarGroup, "hydropathy">;
const tabOf = (g: VarGroup): Tab => (g === "hydropathy" ? "aminoAcid" : g);

/** mtDNA first; life-history traits last. */
const TABS: Tab[] = ["composition", "codon", "aminoAcid", "fourfold", "structure", "trait"];
const TAB_LABEL: Record<Tab, string> = {
  trait: "Life history",
  composition: "Size and GC",
  codon: "Codons",
  aminoAcid: "Amino acids",
  fourfold: "Fourfold sites",
  structure: "Repeats",
};
const KIND_LETTER: Record<VarGroup, string> = {
  trait: "T",
  composition: "G",
  codon: "C",
  aminoAcid: "A",
  hydropathy: "H",
  fourfold: "F",
  structure: "R",
};
const MEASURES: { m: Measure; label: string }[] = [
  { m: "size", label: "Length" },
  { m: "gc", label: "GC %" },
  { m: "gcSkew", label: "GC skew" },
  { m: "atSkew", label: "AT skew" },
];
const RESULT_LIMIT = 60;

const Svg = (p: { name: keyof typeof ICONS; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={p.size ?? 20}
    height={p.size ?? 20}
    fill="none"
    stroke="currentColor"
    stroke-width="2.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    innerHTML={ICONS[p.name]}
  />
);

const groupPenalty: Record<VarGroup, number> = {
  trait: 0,
  composition: 0.4,
  codon: 0.8,
  aminoAcid: 0.8,
  hydropathy: 0.6,
  fourfold: 0.8,
  structure: 0.6,
};

function searchVars(query: string): Variable[] {
  const tokens = query.toLowerCase().replace(/[%,()]/g, " ").split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const out: { v: Variable; s: number }[] = [];
  for (const v of getCatalog().list) {
    const label = v.label.toLowerCase();
    const short = v.short.toLowerCase();
    let s = 0;
    let ok = true;
    for (const t of tokens) {
      if (short.split(/\s+/).includes(t)) s += 4;
      else if (label.startsWith(t) || short.startsWith(t)) s += 3;
      else if (label.includes(t)) s += 2;
      else if (v.search.includes(t)) s += 1;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const gene =
      v.kind === "feature" &&
      !v.region.startsWith("total") &&
      !v.region.startsWith("major") &&
      v.region !== "D_Loop" &&
      !v.region.startsWith("rRNA");
    out.push({ v, s: s - groupPenalty[v.group] - (gene ? 0.3 : 0) });
  }
  return out.sort((a, b) => b.s - a.s).map((x) => x.v);
}

export default function VariablePicker(props: Props) {
  const uid = createUniqueId();
  const titleId = `vp-title-${uid}`;
  const listId = `vp-list-${uid}`;
  const tabsId = `vp-tabs-${uid}`;
  let dialog: HTMLDialogElement | undefined;
  let searchInput: HTMLInputElement | undefined;
  let listEl: HTMLDivElement | undefined;

  const current = createMemo(() => getVariable(props.value));
  const [query, setQuery] = createSignal("");
  const [active, setActive] = createSignal(0);
  const [tab, setTab] = createSignal<Tab>("composition");
  const [region, setRegion] = createSignal<VarRegion>("total_pc");
  /** The selected region if this tab has it, else all protein-coding genes (every per-gene tab has them). */
  const regionIn = (list: readonly VarRegion[]): VarRegion => (list.includes(region()) ? region() : "total_pc");

  const results = createMemo(() => searchVars(query()));
  const shown = createMemo(() => results().slice(0, RESULT_LIMIT));

  const open = () => {
    const v = current();
    setQuery("");
    setActive(0);
    setTab(tabOf(v?.group ?? "composition"));
    if (v?.kind === "feature" && ["codon", "aminoAcid", "hydropathy", "fourfold"].includes(v.group)) setRegion(v.region);
    else setRegion("total_pc");
    dialog?.showModal();
    // Phones: do not pop the keyboard over the sheet straight away; desktops: type immediately.
    if (window.matchMedia("(min-width: 48rem)").matches) searchInput?.focus();
  };
  const close = () => dialog?.close();
  const pick = (key: string) => {
    props.onChange(key);
    close();
  };

  createEffect(() => {
    // Keep the active option visible while arrowing through results.
    const i = active();
    if (!query()) return;
    listEl?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" });
  });

  const onSearchKey = (e: KeyboardEvent) => {
    const n = shown().length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? n - 1 : a - 1));
    } else if (e.key === "Enter" && n) {
      e.preventDefault();
      const v = shown()[active()];
      if (v) pick(v.key);
    } else if (e.key === "Escape" && query()) {
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
    }
  };

  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab());
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const t = TABS[next] ?? "composition";
    setTab(t);
    document.getElementById(`${tabsId}-${t}`)?.focus();
  };

  const isCurrent = (key: string) => props.value === key;
  const traits = createMemo(() => getCatalog().list.filter((v) => v.kind === "trait"));

  const OptionButton = (p: { v: Variable | undefined; text: string; sub?: string; class?: string }) => (
    <Show when={p.v}>
      {(v) => (
        <button
          type="button"
          class={`vp-cell${p.class ? ` ${p.class}` : ""}`}
          aria-pressed={isCurrent(v().key)}
          aria-label={v().label}
          title={v().label}
          onClick={() => pick(v().key)}
        >
          <span class="vp-cell__main">{p.text}</span>
          <Show when={p.sub}>
            <span class="vp-cell__sub">{p.sub}</span>
          </Show>
        </button>
      )}
    </Show>
  );

  const RegionChips = (p: { regions: readonly VarRegion[] }) => (
    <div class="vp-regions" role="group" aria-label="Region">
      <For each={p.regions}>
        {(r) => (
          <button type="button" class="vp-region" aria-pressed={regionIn(p.regions) === r} onClick={() => setRegion(r)}>
            {regionPickerLabel(r)}
          </button>
        )}
      </For>
    </div>
  );

  return (
    <>
      <button type="button" class="vp-trigger" aria-haspopup="dialog" onClick={open}>
        <span class="vp-trigger__axis" aria-hidden="true">
          {props.axis.toUpperCase()}
        </span>
        <span class="vp-trigger__text">
          <span class="visually-hidden">{props.axis === "x" ? "X axis: " : "Y axis: "}</span>
          <span class="vp-trigger__label">{current()?.label ?? props.value}</span>
          <span class="vp-trigger__ctx">{current() ? variableContext(current() as Variable) : ""}</span>
        </span>
        <span class="vp-trigger__chev">
          <Svg name="sortDesc" size={18} />
        </span>
        <span class="visually-hidden">, change</span>
      </button>

      <dialog
        ref={dialog}
        class="vp-dialog"
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === dialog) close();
        }}
      >
        <div class="vp-dialog__inner">
          <div class="vp-dialog__head">
            <h2 id={titleId} class="vp-dialog__title">
              Choose the {props.axis === "x" ? "X (horizontal)" : "Y (vertical)"} axis
            </h2>
            <button type="button" class="vp-close" aria-label="Close" onClick={close}>
              <Svg name="close" size={22} />
            </button>
          </div>
          <div class="vp-dialog__search">
            <div class="search__box">
              <svg
                class="search__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.6"
                stroke-linecap="round"
                aria-hidden="true"
                innerHTML={ICONS.search}
              />
              <input
                ref={searchInput}
                class="search__input"
                type="search"
                autocomplete="off"
                spellcheck={false}
                placeholder="Search, e.g. ND6 GC, CUA, body mass"
                aria-label={`Search ${fmtInt(getCatalog().list.length)} variables`}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={query().length > 0}
                aria-controls={listId}
                aria-activedescendant={query() && shown().length ? `${listId}-${active()}` : undefined}
                value={query()}
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKey}
              />
              <Show when={query()}>
                <button
                  type="button"
                  class="search__clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    searchInput?.focus();
                  }}
                >
                  <Svg name="close" size={18} />
                </button>
              </Show>
            </div>
          </div>

          <div class="vp-dialog__body">
            <Show
              when={query()}
              fallback={
                <>
                  <div class="vp-tabs" role="tablist" aria-label="Kind of variable" onKeyDown={onTabKey}>
                    <For each={TABS}>
                      {(t) => (
                        <button
                          type="button"
                          role="tab"
                          id={`${tabsId}-${t}`}
                          class="vp-tab"
                          aria-selected={tab() === t}
                          aria-controls={`${tabsId}-panel`}
                          tabIndex={tab() === t ? 0 : -1}
                          onClick={() => setTab(t)}
                        >
                          {TAB_LABEL[t]}
                        </button>
                      )}
                    </For>
                  </div>
                  <div class="vp-panel" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab()}`}>
                    <Show when={tab() === "trait"}>
                      <p class="vp-hint">Life-history traits from AnAge. Lifespan, mass and timing are best on a log scale.</p>
                      <ul role="list" class="vp-traits">
                        <For each={traits()}>
                          {(v) => (
                            <li>
                              <button
                                type="button"
                                class="vp-trait"
                                aria-pressed={isCurrent(v.key)}
                                onClick={() => pick(v.key)}
                              >
                                <span class="vp-trait__label">{v.label}</span>
                                <span class="vp-trait__meta">
                                  {(() => {
                                    const n = props.count?.(v.key);
                                    return n === undefined ? "" : `${fmtInt(n)} species`;
                                  })()}
                                </span>
                              </button>
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>

                    <Show when={tab() === "composition"}>
                      <p class="vp-hint">Length, GC content and strand skews of each region, from the RefSeq record.</p>
                      <div class="vp-matrix" role="group" aria-label="Region and measure">
                        <For each={REGION_ORDER}>
                          {(r) => (
                            <div class="vp-matrix__row">
                              <span class="vp-matrix__region">{regionPickerLabel(r)}</span>
                              <For each={MEASURES}>
                                {(m) => <OptionButton v={getVariable(`${m.m}:${r}`)} text={m.label} />}
                              </For>
                            </div>
                          )}
                        </For>
                        <div class="vp-matrix__row">
                          <span class="vp-matrix__region">Whole genome</span>
                          <OptionButton v={getVariable("noncoding:total_mtDNA")} text="Non-coding length" class="vp-cell--wide" />
                        </div>
                      </div>
                    </Show>

                    <Show when={tab() === "codon"}>
                      <p class="vp-hint">
                        Codon frequency, % of all codons in the region. Amino acids follow the vertebrate mitochondrial
                        code.
                      </p>
                      <RegionChips regions={CODING_REGIONS} />
                      <div class="vp-grid vp-grid--codons" role="group" aria-label={`Codons in ${regionPickerLabel(regionIn(CODING_REGIONS))}`}>
                        <For each={CODONS}>
                          {(c) => (
                            <OptionButton
                              v={getVariable(`codon:${regionIn(CODING_REGIONS)}:${c}`)}
                              text={c}
                              sub={codonAminoAcid(c)}
                              class="vp-cell--codon"
                            />
                          )}
                        </For>
                      </div>
                    </Show>

                    <Show when={tab() === "aminoAcid"}>
                      <p class="vp-hint">
                        Amino-acid frequency, % of sense codons in the region. GRAVY is the mean Kyte–Doolittle
                        hydropathy of the encoded protein.
                      </p>
                      <RegionChips regions={CODING_REGIONS} />
                      <div class="vp-grid" role="group" aria-label={`Amino acids in ${regionPickerLabel(regionIn(CODING_REGIONS))}`}>
                        <For each={AMINO_ACID_LETTERS}>
                          {(a) => (
                            <OptionButton
                              v={getVariable(`aa:${regionIn(CODING_REGIONS)}:${a}`)}
                              text={AMINO_ACIDS[a]?.three ?? a}
                              sub={AMINO_ACIDS[a]?.name ?? ""}
                            />
                          )}
                        </For>
                        <OptionButton v={getVariable(`gravy:${regionIn(CODING_REGIONS)}`)} text="GRAVY" sub="Hydropathy" />
                      </div>
                    </Show>

                    <Show when={tab() === "fourfold"}>
                      <p class="vp-hint">
                        Base composition at fourfold-degenerate sites, % of those sites. Gene sense reads each gene's own
                        strand; the heavy strand is defined only for chordate records in the usual gene order.
                      </p>
                      <RegionChips regions={FOURFOLD_REGIONS} />
                      <div class="vp-matrix" role="group" aria-label={`Fourfold sites of ${regionPickerLabel(regionIn(FOURFOLD_REGIONS))}`}>
                        <Show when={getVariable(`ff:${regionIn(FOURFOLD_REGIONS)}:A`)}>
                          <div class="vp-matrix__row">
                            <span class="vp-matrix__region">Gene sense</span>
                            <For each={["A", "C", "G", "U"]}>
                              {(b) => <OptionButton v={getVariable(`ff:${regionIn(FOURFOLD_REGIONS)}:${b}`)} text={b} />}
                            </For>
                          </div>
                        </Show>
                        <Show when={getVariable(`ffH:${regionIn(FOURFOLD_REGIONS)}:A`)}>
                          <div class="vp-matrix__row">
                            <span class="vp-matrix__region">Heavy strand</span>
                            <For each={["A", "C", "G", "T"]}>
                              {(b) => <OptionButton v={getVariable(`ffH:${regionIn(FOURFOLD_REGIONS)}:${b}`)} text={b} />}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </Show>

                    <Show when={tab() === "structure"}>
                      <p class="vp-hint">
                        Perfect repeats, non-B DNA motifs and simple repeats of the whole record and of the major arc (from
                        the light-strand origin to the control region), counted on the RefSeq sequence.
                      </p>
                      <div class="vp-matrix vp-matrix--measures" role="group" aria-label="Measure and region">
                        <For each={STRUCTURE_SPECS}>
                          {(m) => (
                            <div class="vp-matrix__row">
                              <span class="vp-matrix__region">{m.short[0]?.toUpperCase() + m.short.slice(1)}</span>
                              <For each={STRUCTURE_REGIONS}>
                                {(r) => <OptionButton v={getVariable(`${m.measure}:${m.sub}:${r}`)} text={regionPickerLabel(r)} />}
                              </For>
                            </div>
                          )}
                        </For>
                        <div class="vp-matrix__row">
                          <span class="vp-matrix__region">Length</span>
                          <span />
                          <OptionButton v={getVariable("size:major_arc")} text="Major arc" />
                        </div>
                        <div class="vp-matrix__row">
                          <span class="vp-matrix__region">Control regions</span>
                          <OptionButton v={getVariable("controlRegions:total_mtDNA")} text="Whole genome" />
                        </div>
                      </div>
                      <p class="vp-hint">
                        Repeat pairs with one arm in each deletion contact zone (ATP8 to COX3, and ND5 to CYTB).
                      </p>
                      <div class="vp-grid vp-grid--three" role="group" aria-label="Repeat pairs bridging the contact zones">
                        <For each={CONTACT_KINDS}>
                          {(k) => <OptionButton v={getVariable(`contactZone:${k}:total_mtDNA`)} text={k[0]?.toUpperCase() + k.slice(1)} sub="pairs" />}
                        </For>
                      </div>
                    </Show>
                  </div>
                </>
              }
            >
              <div ref={listEl} id={listId} role="listbox" aria-label="Matching variables" class="vp-results">
                <Show
                  when={shown().length}
                  fallback={<p class="vp-empty">Nothing matches “{query()}”. Try a gene (ND6), a codon (CUA) or a trait.</p>}
                >
                  <For each={shown()}>
                    {(v, i) => (
                      <div
                        id={`${listId}-${i()}`}
                        data-i={i()}
                        role="option"
                        class="vp-result"
                        aria-selected={active() === i()}
                        aria-current={isCurrent(v.key) ? "true" : undefined}
                        onPointerMove={() => setActive(i())}
                        onClick={() => pick(v.key)}
                      >
                        <span class={`vp-result__kind vp-result__kind--${v.group}`} aria-hidden="true">
                          {KIND_LETTER[v.group]}
                        </span>
                        <span class="vp-result__text">
                          <span class="vp-result__label">{v.label}</span>
                          <span class="vp-result__ctx">{GROUP_LABEL[v.group]}</span>
                        </span>
                      </div>
                    )}
                  </For>
                  <Show when={results().length > shown().length}>
                    <p class="vp-more">
                      Showing {shown().length} of {fmtInt(results().length)}. Add a word to narrow it down, e.g. a gene name.
                    </p>
                  </Show>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </dialog>
    </>
  );
}
