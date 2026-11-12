/**
 * Plot explorer island: any mtDNA feature or life-history trait on either axis, with per-axis log
 * scales, scope (all / class / order), highlighted species, live statistics, the pipeline's
 * corrected statistics when they exist, and the "Strongest correlations" ranking.
 * The view is mirrored in the query string (see ~/lib/explore/state), so every view is a link.
 *
 * <Explorer client:idle corrIndex={corrIndex()} speciesCount={922} />
 */
import { createEffect, createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
import Scatter from "~/components/charts/Scatter";
import { ICONS } from "~/components/ui/icons";
import type { TraitKey } from "~/data/schema";
import { CLASS_GROUPS, classColor } from "~/lib/classes";
import { fmtInt, fmtLifespan, fmtNum } from "~/lib/format";
import { type Column, type Dataset, loadColumnByKey, loadCorr, loadDataset, scopeFilter, scopeLabel } from "~/lib/explore/client";
import { fmtP, fmtR } from "~/lib/explore/format";
import { DEFAULT_X, DEFAULT_Y, MAX_HIGHLIGHTS, parseState, serializeState } from "~/lib/explore/state";
import { describePairs, strengthWord } from "~/lib/explore/stats";
import { axisTitle, FEATURE_KEYS, getVariable, type Variable } from "~/lib/explore/variables";
import { type CorrIndex, corrRow } from "~/lib/explore/wire";
import type { ScatterPoint } from "~/lib/scatterTypes";
import { compareUrl, speciesUrl } from "~/lib/urls";
import SpeciesCombobox, { type SpeciesItem } from "./SpeciesCombobox";
import StrongestPanel, { scopeOptionLabel } from "./StrongestPanel";
import VariablePicker from "./VariablePicker";
// Styles: ./explorer.css, imported by the page (tsc does not type side-effect CSS imports).

interface Props {
  corrIndex: CorrIndex;
  speciesCount: number;
}

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

/** "Maximum lifespan" -> "maximum lifespan"; "GC content of ND6" stays as is. */
const phrase = (v: Variable): string => {
  const l = v.label;
  return l.length > 1 && l[1] === l[1]?.toLowerCase() ? l[0]?.toLowerCase() + l.slice(1) : l;
};

const shortName = (name: string, common: string): string => {
  if (!common) return name;
  return common.length > 20 ? common.split(/\s+/).slice(-2).join(" ") : common;
};

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Explorer(props: Props) {
  // ------------------------------------------------------------ view state
  const [xKey, setXKey] = createSignal(DEFAULT_X);
  const [yKey, setYKey] = createSignal(DEFAULT_Y);
  const [logXPref, setLogXPref] = createSignal<boolean | null>(null);
  const [logYPref, setLogYPref] = createSignal<boolean | null>(null);
  const [scope, setScope] = createSignal("all");
  const [highlight, setHighlight] = createSignal<string[]>([]);
  const [fit, setFit] = createSignal(false);
  const [ready, setReady] = createSignal(false);
  const [copied, setCopied] = createSignal("");
  const [announce, setAnnounce] = createSignal("");
  let plotCard: HTMLElement | undefined;

  const xVar = createMemo(() => getVariable(xKey()) ?? (getVariable(DEFAULT_X) as Variable));
  const yVar = createMemo(() => getVariable(yKey()) ?? (getVariable(DEFAULT_Y) as Variable));
  const logX = () => logXPref() ?? xVar().defaultLog;
  const logY = () => logYPref() ?? yVar().defaultLog;

  // ------------------------------------------------------------ data
  const [ds, setDs] = createSignal<Dataset | null>(null);
  const [loadError, setLoadError] = createSignal(false);
  const [cols, setCols] = createSignal(new Map<string, Column>());
  const [colError, setColError] = createSignal<string | null>(null);

  onMount(() => {
    const keys = new Set(FEATURE_KEYS());
    const s = parseState(window.location.search, (k) => keys.has(k) || getVariable(k)?.kind === "trait");
    setXKey(s.x);
    setYKey(s.y);
    setLogXPref(s.logX);
    setLogYPref(s.logY);
    setScope(s.scope);
    setHighlight(s.highlight);
    setFit(s.fit);
    setReady(true);
    loadDataset()
      .then(setDs)
      .catch(() => setLoadError(true));
  });

  createEffect(() => {
    const d = ds();
    if (!d) return;
    for (const key of [xKey(), yKey()]) {
      if (cols().has(key)) continue;
      loadColumnByKey(d, key)
        .then((col) => {
          setCols((m) => new Map(m).set(key, col));
          setColError(null);
        })
        .catch(() => setColError(key));
    }
  });

  // Scope must exist in the data (e.g. a typo in a shared link falls back to all species).
  createEffect(() => {
    const d = ds();
    const s = scope();
    if (!d || s === "all") return;
    const name = s.slice(6);
    const ok = s.startsWith("class:") ? d.classes.some((c) => c.name === name) : d.orders.some((o) => o.name === name);
    if (!ok) setScope("all");
  });

  // ------------------------------------------------------------ URL sync
  createEffect(() => {
    if (!ready()) return;
    const q = serializeState(
      { x: xKey(), y: yKey(), logX: logXPref(), logY: logYPref(), scope: scope(), highlight: highlight(), fit: fit() },
      (k) => getVariable(k)?.defaultLog ?? false,
    );
    if (q !== window.location.search) history.replaceState(history.state, "", `${window.location.pathname}${q}`);
  });

  // ------------------------------------------------------------ the current view
  const view = createMemo(() => {
    const d = ds();
    const xc = cols().get(xKey());
    const yc = cols().get(yKey());
    if (!d || !xc || !yc) return null;
    const inScope = scopeFilter(d, scope());
    const lx = logX();
    const ly = logY();
    const pts: ScatterPoint[] = [];
    const tx: number[] = [];
    const ty: number[] = [];
    let inScopeN = 0;
    let both = 0;
    let droppedLog = 0;
    for (let i = 0; i < d.n; i++) {
      if (!inScope(i)) continue;
      inScopeN++;
      const a = xc[i] ?? Number.NaN;
      const b = yc[i] ?? Number.NaN;
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      both++;
      if ((lx && a <= 0) || (ly && b <= 0)) {
        droppedLog++;
        continue;
      }
      const m = d.species[i];
      if (!m) continue;
      const p: ScatterPoint = { id: m.slug, x: a, y: b, group: m.group, label: m.name, short: shortName(m.name, m.common), href: m.href };
      if (m.common) p.sub = m.common;
      pts.push(p);
      tx.push(lx ? Math.log10(a) : a);
      ty.push(ly ? Math.log10(b) : b);
    }
    return { pts, tx, ty, inScopeN, both, droppedLog };
  });

  const stats = createMemo(() => {
    const v = view();
    return v ? describePairs(v.tx, v.ty) : null;
  });

  const fitLine = createMemo(() => {
    const v = view();
    const s = stats();
    if (!fit() || !v || !s?.fit || v.tx.length < 3) return null;
    const lo = Math.min(...v.tx);
    const hi = Math.max(...v.tx);
    const inv = (t: number, log: boolean) => (log ? 10 ** t : t);
    const { slope, intercept } = s.fit;
    return {
      x1: inv(lo, logX()),
      y1: inv(intercept + slope * lo, logY()),
      x2: inv(hi, logX()),
      y2: inv(intercept + slope * hi, logY()),
    };
  });

  const loadingView = () => !loadError() && (!ds() || !cols().has(xKey()) || !cols().has(yKey()));

  // ------------------------------------------------------------ precomputed statistics
  const pair = createMemo(() => {
    const xv = xVar();
    const yv = yVar();
    if (xv.kind === "trait" && yv.kind === "feature") return { trait: xv.trait, feature: yv.key, traitOnX: true };
    if (yv.kind === "trait" && xv.kind === "feature") return { trait: yv.trait, feature: xv.key, traitOnX: false };
    return null;
  });
  const precompScope = createMemo(() => {
    const p = pair();
    // Only in the browser: resources must not fetch during server rendering.
    if (!p || !ready()) return null;
    const ti = props.corrIndex.traits.indexOf(p.trait);
    const si = props.corrIndex.scopes.indexOf(scope());
    return ti >= 0 && si >= 0 && (props.corrIndex.rows[ti]?.[si] ?? 0) > 0 ? { trait: p.trait, scope: scope() } : null;
  });
  const [precomp] = createResource(precompScope, ({ trait, scope: s }) => loadCorr(trait, s));
  const precompRow = createMemo(() => {
    const p = pair();
    const d = precomp.latest;
    if (!p || !d || !precompScope() || d.file.trait !== p.trait || d.file.scope !== scope()) return null;
    const i = d.index.get(p.feature);
    return i === undefined ? null : corrRow(d.file, i);
  });

  // ------------------------------------------------------------ actions
  const setAxis = (axis: "x" | "y", key: string) => {
    if (axis === "x") {
      setXKey(key);
      setLogXPref(null);
    } else {
      setYKey(key);
      setLogYPref(null);
    }
  };
  const swap = () => {
    const [x, y, lx, ly] = [xKey(), yKey(), logXPref(), logYPref()];
    setXKey(y);
    setYKey(x);
    setLogXPref(ly);
    setLogYPref(lx);
  };
  const addHighlight = (slug: string) =>
    setHighlight((h) => (h.includes(slug) ? h : [...h, slug].slice(-MAX_HIGHLIGHTS)));
  const removeHighlight = (slug: string) => {
    setHighlight((h) => h.filter((s) => s !== slug));
    // The chip (and its focused button) is gone: continue in the highlight search box.
    window.setTimeout(() => plotCard?.querySelector<HTMLInputElement>(".xp-hl input")?.focus(), 0);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("Link copied");
    } catch {
      setCopied("Copy the address bar to share");
    }
    window.setTimeout(() => setCopied(""), 2600);
  };

  const pickFromRanking = (trait: TraitKey, feature: string, s: string) => {
    setXKey(trait);
    setLogXPref(null);
    setYKey(feature);
    setLogYPref(null);
    setScope(s);
    setAnnounce(`Plotted ${getVariable(feature)?.label ?? feature} against ${getVariable(trait)?.label ?? trait}`);
    plotCard?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  };

  // ------------------------------------------------------------ derived labels
  const speciesItems = (): Promise<SpeciesItem[]> =>
    loadDataset().then((d) => {
      const life = d.file.traits.maxLongevityYears;
      return d.species.map((m, i) => ({
        slug: m.slug,
        name: m.name,
        common: m.common,
        meta: `${m.order} · ${fmtLifespan(life[i] ?? null)}`,
        color: classColor(m.className),
      }));
    });

  const traitCount = (key: string): number | undefined => {
    const d = ds();
    const v = getVariable(key);
    if (!d || v?.kind !== "trait") return undefined;
    return (d.file.traits[v.trait] ?? []).filter((x) => x !== null).length;
  };

  const plottedIds = createMemo(() => new Set(view()?.pts.map((p) => p.id) ?? []));
  const highlightInfo = createMemo(() => {
    const d = ds();
    return highlight().map((slug) => {
      const i = d?.indexBySlug.get(slug);
      const m = i === undefined ? undefined : d?.species[i];
      return { slug, name: m?.name ?? slug, common: m?.common ?? "", known: Boolean(m), shown: plottedIds().has(slug) };
    });
  });

  const scopeText = () => (scope() === "all" ? "all species" : scopeLabel(ds(), scope()));

  const headline = createMemo(() => {
    const s = stats();
    if (!s) return null;
    if (s.n < 3) return { title: "Not enough species", text: "Fewer than three species have both values here." };
    const rho = s.spearmanRho;
    const word = strengthWord(rho);
    const sig = s.spearmanP < 0.05;
    if (word === "no clear" || !Number.isFinite(rho))
      return {
        title: "No clear relationship",
        text: `${phrase(yVar())[0]?.toUpperCase()}${phrase(yVar()).slice(1)} barely changes with ${phrase(xVar())} in ${scopeText()}.`,
      };
    const dir = rho > 0 ? "positive" : "negative";
    return {
      title: `${word[0]?.toUpperCase()}${word.slice(1)} ${dir} correlation${sig ? "" : ", not significant"}`,
      text: `Species with a higher ${phrase(xVar())} tend to have a ${rho > 0 ? "higher" : "lower"} ${phrase(yVar())}.`,
    };
  });

  const transformNote = () => {
    const parts: string[] = [];
    if (logX()) parts.push(`log10 of ${xVar().short.toLowerCase()}`);
    if (logY()) parts.push(`log10 of ${yVar().short.toLowerCase()}`);
    return parts.length ? `Computed on ${parts.join(" and ")}, as plotted.` : "Computed on the plotted values.";
  };

  const verdict = createMemo(() => {
    const r = precompRow();
    if (!r) return null;
    const qOk = r.q !== null && r.q < 0.05;
    const picOk = r.picP !== null && r.picP < 0.05;
    if (qOk && picOk) return { tone: "good", text: "Holds up after both corrections" };
    if (qOk) return { tone: "warn", text: "Significant across species, but not along the tree (PIC)" };
    if (picOk) return { tone: "warn", text: "Not significant across species, but the contrasts along the tree are" };
    return { tone: "muted", text: "Not significant after either correction" };
  });

  const precompReason = createMemo(() => {
    const p = pair();
    if (!p) {
      return xVar().kind === "trait"
        ? "Precomputed tests pair one life-history trait with one mtDNA feature; both axes are traits here."
        : "Precomputed tests pair one life-history trait with one mtDNA feature; both axes are mtDNA features here.";
    }
    if (!precompScope()) {
      return `Precomputed tests exist for all species, the six main classes and the ${fmtInt(
        props.corrIndex.scopes.filter((s) => s.startsWith("order:")).length,
      )} orders with at least 20 species; ${scopeText()} is not one of them.`;
    }
    if (precomp.loading) return "Loading…";
    if (precomp.error) return "The precomputed statistics could not be loaded.";
    return "This feature was not tested in this group: per-gene codon and amino-acid features are tested in all species and in classes only, and every test needs at least 10 species with both values.";
  });

  const ariaLabel = () =>
    `Scatter plot of ${yVar().label} against ${xVar().label} for ${fmtInt(view()?.pts.length ?? 0)} species (${scopeText()}), coloured by class`;

  return (
    <div class="xp">
      <div class="xp-layout">
        <section class="card xp-plot" ref={plotCard} aria-label="Plot" id="plot">
          <div class="xp-axes">
            <div class="xp-axis">
              <VariablePicker axis="y" value={yKey()} onChange={(k) => setAxis("y", k)} count={traitCount} />
              <button
                type="button"
                role="switch"
                class="xp-switch"
                aria-checked={logY()}
                onClick={() => setLogYPref(!logY())}
              >
                <span class="xp-switch__track" aria-hidden="true" />
                <span>
                  Log<span class="visually-hidden"> scale on the Y axis</span>
                </span>
              </button>
            </div>
            <button type="button" class="xp-swap" onClick={swap} aria-label="Swap the X and Y axes" title="Swap axes">
              <Svg name="sort" size={20} />
            </button>
            <div class="xp-axis">
              <VariablePicker axis="x" value={xKey()} onChange={(k) => setAxis("x", k)} count={traitCount} />
              <button
                type="button"
                role="switch"
                class="xp-switch"
                aria-checked={logX()}
                onClick={() => setLogXPref(!logX())}
              >
                <span class="xp-switch__track" aria-hidden="true" />
                <span>
                  Log<span class="visually-hidden"> scale on the X axis</span>
                </span>
              </button>
            </div>
          </div>

          <div class="xp-filters">
            <label class="field xp-scope">
              Species
              <select class="select" onChange={(e) => setScope(e.currentTarget.value)} disabled={!ds()}>
                {/* Options appear after the data loads, so each one carries its own `selected`. */}
                <option value="all" selected={scope() === "all"}>
                  All species ({fmtInt(ds()?.n ?? props.speciesCount)})
                </option>
                <Show when={ds()}>
                  {(d) => (
                    <>
                      <optgroup label="Classes">
                        <For each={d().classes}>
                          {(c) => (
                            <option value={`class:${c.name}`} selected={scope() === `class:${c.name}`}>
                              {c.label} ({fmtInt(c.count)})
                            </option>
                          )}
                        </For>
                      </optgroup>
                      <optgroup label="Orders">
                        <For each={d().orders.filter((o) => o.count >= 3 || scope() === `order:${o.name}`)}>
                          {(o) => (
                            <option value={`order:${o.name}`} selected={scope() === `order:${o.name}`}>
                              {o.name} ({fmtInt(o.count)})
                            </option>
                          )}
                        </For>
                      </optgroup>
                    </>
                  )}
                </Show>
                <Show when={!ds() && scope() !== "all"}>
                  <option value={scope()} selected>
                    {scope().slice(6)}
                  </option>
                </Show>
              </select>
            </label>
            <div class="field xp-hl">
              <span>Highlight species</span>
              <SpeciesCombobox
                load={speciesItems}
                onSelect={addHighlight}
                exclude={new Set(highlight())}
                placeholder="Find a species"
                label="Highlight a species on the plot"
                class="xp-search"
                disabled={highlight().length >= MAX_HIGHLIGHTS}
              />
            </div>
          </div>

          <Show when={highlightInfo().length}>
            <ul class="xp-chips" aria-label="Highlighted species">
              <For each={highlightInfo()}>
                {(h) => (
                  <li class="xp-chip" classList={{ "is-off": !h.shown }}>
                    <span class="xp-chip__dot" aria-hidden="true" />
                    <a href={speciesUrl(h.slug)} class="xp-chip__name">
                      {h.common || <i>{h.name}</i>}
                    </a>
                    <Show when={!h.shown && ds() && !loadingView()}>
                      <span class="xp-chip__note">{h.known ? "not in this view" : "unknown"}</span>
                    </Show>
                    <button type="button" class="xp-chip__x" aria-label={`Stop highlighting ${h.name}`} onClick={() => removeHighlight(h.slug)}>
                      <Svg name="close" size={16} />
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <div class="xp-chart">
            <Show
              when={view()}
              fallback={
                <div class="xp-skeleton" role="status">
                  <span>
                    {loadError()
                      ? "The data could not be loaded. Check your connection and reload the page."
                      : colError()
                        ? "These values could not be loaded."
                        : `Loading ${fmtInt(props.speciesCount)} species…`}
                  </span>
                </div>
              }
            >
              {(v) => (
                <Scatter
                  points={v().pts}
                  groups={CLASS_GROUPS}
                  xLabel={axisTitle(xVar(), logX())}
                  yLabel={axisTitle(yVar(), logY())}
                  xLog={logX()}
                  yLog={logY()}
                  xTickFormat={xVar().tick}
                  yTickFormat={yVar().tick}
                  xValueFormat={xVar().value}
                  yValueFormat={yVar().value}
                  highlightIds={highlight()}
                  line={fitLine()}
                  interactiveLegend
                  height={430}
                  ariaLabel={ariaLabel()}
                  emptyText="No species in this group have both values."
                  note="Hover or tap a point to see the species; select it again to open its page. Legend buttons spotlight a class."
                />
              )}
            </Show>
          </div>

          <div class="xp-foot">
            <button type="button" role="switch" class="xp-switch" aria-checked={fit()} onClick={() => setFit(!fit())}>
              <span class="xp-switch__track" aria-hidden="true" />
              <span>Least-squares fit line</span>
            </button>
            <div class="xp-foot__actions">
              <span class="xp-copied" role="status">
                {copied()}
              </span>
              <a class="btn btn--soft btn--sm" href={compareUrl(highlight())} hidden={highlight().length < 2}>
                Compare highlighted
              </a>
              <button type="button" class="btn btn--primary btn--sm" onClick={copyLink}>
                Copy link
              </button>
            </div>
          </div>
          <div class="visually-hidden" aria-live="polite">
            {announce()}
          </div>

          <section class="xp-live" aria-labelledby="xp-stats-title">
            <div class="xp-live__head">
              <span class="eyebrow">This view</span>
              <h2 class="card__title" id="xp-stats-title">
                Live statistics
              </h2>
            </div>
            <Show when={stats()} fallback={<p class="muted">Statistics appear once the data has loaded.</p>}>
              {(s) => (
                <div class="xp-live__body">
                  <div class="xp-live__text">
                    <Show when={headline()}>
                      {(h) => (
                        <div class="xp-verdict">
                          <p class="xp-verdict__title">{h().title}</p>
                          <p class="xp-verdict__text">{h().text}</p>
                        </div>
                      )}
                    </Show>
                  </div>
                  <dl class="xp-tiles">
                    <div class="xp-tile">
                      <dt>Species</dt>
                      <dd>{fmtInt(s().n)}</dd>
                    </div>
                    <div class="xp-tile">
                      <dt>
                        Spearman <span aria-hidden="true">ρ</span>
                        <span class="visually-hidden">rho</span>
                      </dt>
                      <dd>{fmtR(s().spearmanRho)}</dd>
                    </div>
                    <div class="xp-tile">
                      <dt>Pearson r</dt>
                      <dd>{fmtR(s().pearsonR)}</dd>
                    </div>
                    <div class="xp-tile">
                      <dt>p (two-tailed)</dt>
                      <dd class="xp-tile__p">{fmtP(s().pearsonP)}</dd>
                    </div>
                  </dl>
                  <ul role="list" class="xp-notes">
                    <li>{transformNote()} Spearman ρ uses ranks, so it is the same on either scale (p = {fmtP(s().spearmanP)}).</li>
                    <Show when={fit() && s().fit}>
                      {(f) => (
                        <li>
                          Fit: {logY() ? "log10 y" : "y"} = {fmtNum(f().intercept, 3)} {f().slope < 0 ? "−" : "+"}{" "}
                          {fmtNum(Math.abs(f().slope), 3)} × {logX() ? "log10 x" : "x"}, R² = {fmtNum(f().r2, 3)}
                        </li>
                      )}
                    </Show>
                    <Show when={(view()?.droppedLog ?? 0) > 0}>
                      <li>
                        {fmtInt(view()?.droppedLog ?? 0)} species with zero or negative values cannot be shown on a log axis.
                      </li>
                    </Show>
                    <Show when={view()}>
                      {(v) => (
                        <li>
                          {fmtInt(v().both)} of {fmtInt(v().inScopeN)} species in {scopeText()} have both values.
                        </li>
                      )}
                    </Show>
                  </ul>
                </div>
              )}
            </Show>
          </section>
        </section>

        <aside class="xp-side" aria-label="Corrected statistics">
          <section class="card xp-pre" aria-labelledby="xp-pre-title">
            <div>
              <span class="eyebrow">Precomputed by the pipeline</span>
              <h2 class="card__title" id="xp-pre-title">
                Corrected statistics
              </h2>
            </div>
            <Show
              when={precompRow()}
              fallback={
                <p class="xp-pre__na">
                  <Svg name="info" size={20} />
                  <span>{precompReason()}</span>
                </p>
              }
            >
              {(r) => (
                <>
                  <Show when={verdict()}>
                    {(v) => <p class={`xp-badge xp-badge--${v().tone}`}>{v().text}</p>}
                  </Show>
                  <dl class="xp-pre__list">
                    <div>
                      <dt>q-value</dt>
                      <dd>{fmtP(r().q)}</dd>
                      <p>
                        False discovery rate after testing every mtDNA feature against {phrase(getVariable(pair()?.trait ?? "") ?? xVar())} in{" "}
                        {precompScope()?.scope === "all" ? "all species" : scopeOptionLabel(scope())}.
                      </p>
                    </div>
                    <div>
                      <dt>PIC r</dt>
                      <dd>
                        {fmtR(r().pic)} <small>p = {fmtP(r().picP)}</small>
                      </dd>
                      <p>Correlation of changes along the dated tree, so close relatives do not count as independent evidence.</p>
                    </div>
                    <Show when={pair()?.trait === "maxLongevityYears"}>
                      <div>
                        <dt>Partial r</dt>
                        <dd>
                          {fmtR(r().partialR)} <small>p = {fmtP(r().partialP)}</small>
                        </dd>
                        <p>Lifespan effect with adult body mass held constant (n = {fmtInt(r().partialN)}).</p>
                      </div>
                    </Show>
                    <div>
                      <dt>Pooled ρ</dt>
                      <dd>
                        {fmtR(r().rho)} <small>n = {fmtInt(r().n)}</small>
                      </dd>
                      <p>
                        The same test on log10 of the trait
                        {(pair()?.traitOnX ? logX() : logY()) ? ", as plotted." : ". Switch the trait axis to log to match this view."}
                      </p>
                    </div>
                  </dl>
                </>
              )}
            </Show>
          </section>
        </aside>
      </div>

      <StrongestPanel index={props.corrIndex} onPick={pickFromRanking} />
    </div>
  );
}
