/**
 * Circular mitochondrial genome map (Solid island, rendered on the server so the SVG is in the
 * static HTML). Outer track: + strand, inner track: − strand, arrow tips show direction;
 * the D-loop spans both tracks. Inside: the kb scale and a ring of GC% per gene.
 *
 * Interaction: hover, tap or Tab to a feature to see it in the centre and in the side panel;
 * arrow keys move between features; features with a gene page are links (on touch, the first
 * tap selects, the second opens). Styles: ./genome.css (loaded by GenomeMapFigure.astro).
 *
 * <GenomeMap client:visible id="sp-map" features={features} sizeBp={16569} gc={{ ND1: 47.5 }}
 *            genomeGc={44.4} name="Homo sapiens" highlight="ND1" />
 */
import { createMemo, createSignal, For, Show } from "solid-js";
import { fmtBp, fmtInt, fmtPct } from "~/lib/format";
import { featureLength, GC_SPAN, layoutGenome, R, VIEW, type MapFeature } from "~/lib/genome/layout";
import {
  FEATURE_CLASS,
  FEATURE_COLOR,
  FEATURE_KIND,
  featureFullName,
  featureSymbol,
  hasGenePage,
} from "~/lib/genome/names";
import { geneUrl } from "~/lib/urls";

export interface GenomeMapProps {
  /** Unique on the page; prefixes SVG ids. */
  id: string;
  features: MapFeature[];
  sizeBp: number;
  /** GC% by region name (ND1, rRNA-12S, D_Loop ...). */
  gc: Record<string, number>;
  genomeGc: number;
  /** Scientific name, shown in the centre. */
  name: string;
  /** Region drawn in full colour while the others are muted (gene pages). */
  highlight?: string;
  /** Link features that have a gene page (default true). */
  links?: boolean;
  /** Accessible name of the map. */
  label?: string;
}

const TYPE_ORDER = ["CDS", "rRNA", "tRNA", "D-loop"] as const;
const KIND_PLURAL: Record<(typeof TYPE_ORDER)[number], string> = {
  CDS: "Protein-coding",
  rRNA: "rRNA",
  tRNA: "tRNA",
  "D-loop": "D-loop",
};

const strandText = (s: 1 | -1) => (s === 1 ? "+" : "−");

export default function GenomeMap(props: GenomeMapProps) {
  const layout = createMemo(() => layoutGenome(props.features, props.sizeBp, props.gc, props.genomeGc));
  const links = () => props.links !== false;
  const hlIndex = createMemo(() => (props.highlight ? props.features.findIndex((f) => f.name === props.highlight) : -1));
  const hlSet = createMemo(() => {
    const s = new Set<number>();
    if (props.highlight) props.features.forEach((f, i) => f.name === props.highlight && s.add(i));
    return s;
  });

  const [active, setActive] = createSignal<number | null>(null);
  const [pinned, setPinned] = createSignal(false);
  const [focusIdx, setFocusIdx] = createSignal<number>(Math.max(0, hlIndex()));
  let svg: SVGSVGElement | undefined;
  let lastPointer = "mouse";

  /** Feature shown in the centre and the side panel: the active one, else the highlighted gene. */
  const shown = createMemo(() => {
    const a = active();
    if (a !== null) return a;
    return hlIndex() >= 0 ? hlIndex() : null;
  });

  const order = createMemo(() =>
    props.features.map((f, i) => ({ i, s: f.start })).sort((a, b) => a.s - b.s).map((x) => x.i),
  );

  const counts = createMemo(() => {
    const c: Record<string, number> = {};
    for (const f of props.features) c[f.type] = (c[f.type] ?? 0) + 1;
    return c;
  });

  const href = (i: number): string | undefined => {
    const f = props.features[i];
    return f && links() && hasGenePage(f.name) ? geneUrl(f.name) : undefined;
  };

  const gcOf = (i: number): number | undefined => {
    const f = props.features[i];
    return f ? props.gc[f.name] : undefined;
  };

  const ariaFor = (i: number): string => {
    const f = props.features[i]!;
    const parts = [
      featureSymbol(f.name),
      featureFullName(f.name, f.type),
      `${fmtInt(f.start)} to ${fmtInt(f.end)}`,
      fmtBp(featureLength(f, props.sizeBp)),
      f.type === "D-loop" ? "non-coding" : `${strandText(f.strand)} strand`,
    ];
    const g = gcOf(i);
    if (g !== undefined) parts.push(`GC ${fmtPct(g, 1)}`);
    if (href(i)) parts.push("opens the gene page");
    return parts.join(", ");
  };

  const indexOf = (t: EventTarget | null): number | null => {
    const el = t instanceof Element ? t.closest<SVGElement>("[data-i]") : null;
    const v = el?.dataset["i"];
    return v === undefined ? null : Number(v);
  };

  const focusFeature = (i: number) => {
    setFocusIdx(i);
    svg?.querySelector<SVGElement>(`[data-i="${i}"]`)?.focus();
  };

  const onPointerOver = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned()) return;
    setActive(indexOf(e.target));
  };
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !pinned()) setActive(null);
  };
  const onClick = (e: MouseEvent) => {
    const i = indexOf(e.target);
    // detail 0: activated from the keyboard, never treat as a tap.
    const touch = e.detail !== 0 && lastPointer !== "mouse";
    if (i === null) {
      setActive(null);
      setPinned(false);
      return;
    }
    if (touch && (active() !== i || !pinned())) {
      // First tap selects (and shows the details); a second tap on the same feature follows the link.
      e.preventDefault();
      setActive(i);
      setPinned(true);
      setFocusIdx(i);
      return;
    }
    if (!href(i)) {
      setPinned(active() !== i || !pinned());
      setActive(i);
    }
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const list = order();
    if (!list.length) return;
    const cur = indexOf(e.target);
    const pos = cur === null ? -1 : list.indexOf(cur);
    let next: number | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = list[(pos + 1) % list.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = list[(pos - 1 + list.length) % list.length];
    else if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    else if (e.key === "Escape") {
      setActive(null);
      setPinned(false);
      return;
    } else if ((e.key === "Enter" || e.key === " ") && cur !== null && !href(cur)) {
      e.preventDefault();
      setActive(cur);
      setPinned(true);
      return;
    } else return;
    e.preventDefault();
    if (next !== undefined) focusFeature(next);
  };
  const onFocusIn = (e: FocusEvent) => {
    const i = indexOf(e.target);
    if (i === null) return;
    setFocusIdx(i);
    setActive(i);
  };
  const onFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget;
    if (!(to instanceof Node) || !svg?.contains(to)) {
      setActive(null);
      setPinned(false);
    }
  };

  // classList, not class: Solid compiles the <a> as an HTML element and would assign
  // `className`, which is read-only on SVG elements; classList.toggle works on both.
  const featClass = (i: number): Record<string, boolean> => {
    const f = props.features[i]!;
    return {
      [`gmap__feat gmap__feat--${FEATURE_CLASS[f.type]}`]: true,
      "is-hl": hlSet().has(i),
      "is-active": active() === i,
    };
  };
  const labelClass = (base: string, i: number) => {
    let c = base;
    if (hlSet().has(i)) c += " is-hl";
    if (active() === i) c += " is-active";
    return c;
  };

  // Centre text sized to fit inside the GC ring (radius 100) even when scaled up on phones.
  const centreName = createMemo(() => {
    const n = props.name.trim();
    return { text: n, fs: Math.min(16, 118 / Math.max(1, n.length * 0.55)) };
  });

  const centre = createMemo(() => {
    const i = shown();
    const fit = (s: string) => Math.min(32, 132 / Math.max(1, s.length * 0.62));
    if (i === null) {
      const big = fmtBp(props.sizeBp);
      return { big, bigFs: fit(big), lines: [`GC ${fmtPct(props.genomeGc, 1)}`] };
    }
    const f = props.features[i]!;
    const g = gcOf(i);
    const big = featureSymbol(f.name);
    const lines = [fmtBp(featureLength(f, props.sizeBp))];
    if (g !== undefined) lines.push(`GC ${fmtPct(g, 1)}`);
    return { big, bigFs: fit(big), lines };
  });

  const ariaLabel = () =>
    `${props.label ?? `Circular map of the mitochondrial genome of ${props.name}`}: ${fmtInt(props.features.length)} features on ${fmtBp(
      props.sizeBp,
    )}. Use Tab to reach the features and arrow keys to move between them.`;

  const grad = (t: string) => `${props.id}-g-${t}`;
  const lp = (mode: string, i: number) => `${props.id}-lp-${mode}-${i}`;

  return (
    <figure class="gmap" classList={{ "has-hl": hlIndex() >= 0, "is-active": active() !== null }}>
      <div class="gmap__frame">
        <div class="gmap__canvas">
          <svg
            ref={svg}
            class="gmap__svg"
            viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
            role="group"
            aria-label={ariaLabel()}
            onPointerDown={(e) => (lastPointer = e.pointerType)}
            onPointerOver={onPointerOver}
            onPointerLeave={onPointerLeave}
            onClick={onClick}
            onKeyDown={onKeyDown}
            onFocusIn={onFocusIn}
            onFocusOut={onFocusOut}
          >
            <defs>
              <For each={["cds", "rrna", "trna", "dloop"]}>
                {(t) => (
                  <radialGradient id={grad(t)} cx="0" cy="0" r={R.plusOut} gradientUnits="userSpaceOnUse">
                    <stop offset={String(R.minusIn / R.plusOut)} style={{ "stop-color": `var(--feat-${t})` }} />
                    {/* A slight sheen towards the outer edge: the same token, tinted. */}
                    <stop offset="1" style={{ "stop-color": `color-mix(in oklab, var(--feat-${t}) 80%, white)` }} />
                  </radialGradient>
                )}
              </For>
            </defs>

            <g aria-hidden="true">
              <circle class="gmap__track-bg" r={(R.minusIn + R.plusOut) / 2} stroke-width={R.plusOut - R.minusIn} />
              <circle class="gmap__gc-bg" r={(R.gcIn + R.gcOut) / 2} stroke-width={R.gcOut - R.gcIn} />
              <For each={layout().gcGrid}>{(r) => <circle class="gmap__gc-grid" r={r} />}</For>
              <path class="gmap__origin" d={layout().origin} />
              <circle class="gmap__backbone" r={R.backbone} />
              <circle class="gmap__scale" r={R.scale} />
              <path class="gmap__tick" d={layout().ticks.minor} />
              <path class="gmap__tick gmap__tick--major" d={layout().ticks.major} />
              <g class="gmap__wide">
                <For each={layout().ticks.wide}>
                  {(t) => (
                    <text class={t.origin ? "gmap__kb is-origin" : "gmap__kb"} x={t.x} y={t.y} dy="0.35em" font-size="11">
                      {t.text}
                    </text>
                  )}
                </For>
              </g>
              <g class="gmap__narrow">
                <For each={layout().ticks.narrow}>
                  {(t) => (
                    <text class={t.origin ? "gmap__kb is-origin" : "gmap__kb"} x={t.x} y={t.y} dy="0.35em" font-size="16">
                      {t.text}
                    </text>
                  )}
                </For>
              </g>
            </g>

            <g class="gmap__gc" aria-hidden="true">
              <For each={layout().gcBars}>
                {(b) => (
                  <path class={labelClass(b.dev >= 0 ? "gmap__gc-bar is-up" : "gmap__gc-bar is-down", b.i)} d={b.d} />
                )}
              </For>
              <circle class="gmap__gc-ref" r={R.gcMid} />
            </g>

            <g class="gmap__feats" role="list">
              <For each={layout().arcs}>
                {(g) => (
                  <g role="listitem">
                    {/* Always an <a> (inside a <g>, so Solid creates it in the SVG namespace);
                        features without a gene page get no href and act as images. */}
                    <a
                      href={href(g.i)}
                      classList={featClass(g.i)}
                      data-i={g.i}
                      tabindex={focusIdx() === g.i ? 0 : -1}
                      role={href(g.i) ? undefined : "img"}
                      aria-label={ariaFor(g.i)}
                    >
                      <path d={g.d} fill={`url(#${grad(FEATURE_CLASS[props.features[g.i]!.type])})`} />
                    </a>
                  </g>
                )}
              </For>
            </g>

            <g class="gmap__labels" aria-hidden="true">
              <g class="gmap__wide">
                <For each={layout().inArc.wide}>
                  {(l) => (
                    <>
                      <path id={lp("w", l.i)} d={l.d} fill="none" stroke="none" />
                      <text class={labelClass("gmap__inlabel", l.i)} font-size={String(l.fs)}>
                        <textPath href={`#${lp("w", l.i)}`} startOffset="50%" text-anchor="middle">
                          {l.text}
                        </textPath>
                      </text>
                    </>
                  )}
                </For>
                <For each={layout().outer}>
                  {(l) => (
                    <g class={labelClass("gmap__outer", l.i)}>
                      <path class="gmap__leader" d={l.leader} />
                      <text x={l.x} y={l.y} dy="0.35em" text-anchor={l.anchor} font-size="13">
                        {l.text}
                      </text>
                    </g>
                  )}
                </For>
                <For each={layout().letters.wide}>
                  {(l) => (
                    <text class={labelClass("gmap__letter", l.i)} x={l.x} y={l.y} dy="0.35em" font-size={String(l.fs)}>
                      {l.text}
                    </text>
                  )}
                </For>
              </g>
              <g class="gmap__narrow">
                <For each={layout().inArc.narrow}>
                  {(l) => (
                    <>
                      <path id={lp("n", l.i)} d={l.d} fill="none" stroke="none" />
                      <text class={labelClass("gmap__inlabel", l.i)} font-size={String(l.fs)}>
                        <textPath href={`#${lp("n", l.i)}`} startOffset="50%" text-anchor="middle">
                          {l.text}
                        </textPath>
                      </text>
                    </>
                  )}
                </For>
                <For each={layout().letters.narrow}>
                  {(l) => (
                    <text class={labelClass("gmap__letter", l.i)} x={l.x} y={l.y} dy="0.35em" font-size={String(l.fs)}>
                      {l.text}
                    </text>
                  )}
                </For>
              </g>
            </g>

            <g class="gmap__centre" aria-hidden="true">
              <text class="gmap__centre-name" y="-38" font-size={(Math.round(centreName().fs * 10) / 10).toString()}>
                {centreName().text}
              </text>
              <text class="gmap__centre-big" y="0" dy="0.35em" font-size={(Math.round(centre().bigFs * 10) / 10).toString()}>
                {centre().big}
              </text>
              <For each={centre().lines}>
                {(line, k) => (
                  <text class="gmap__centre-small" y={34 + k() * 20} dy="0.35em" font-size="15">
                    {line}
                  </text>
                )}
              </For>
            </g>
          </svg>
        </div>
      </div>

      <figcaption class="gmap__side">
        <div class="gmap__info" aria-live="polite">
          <Show
            when={shown() !== null ? props.features[shown()!] : undefined}
            fallback={
              <p class="gmap__hint">
                Hover, tap or tab to a feature to see its position, length, strand and GC content.
                {links() ? " Genes and rRNAs open their own pages." : ""}
              </p>
            }
          >
            {(f) => {
              const i = () => shown()!;
              return (
                <>
                  <div class="gmap__info-head">
                    <span class="gmap__swatch" style={{ "--sw": FEATURE_COLOR[f().type] }} />
                    <span class="gmap__info-sym">{featureSymbol(f().name)}</span>
                    <span class="gmap__info-kind">{FEATURE_KIND[f().type]}</span>
                  </div>
                  <p class="gmap__info-name">{featureFullName(f().name, f().type)}</p>
                  <dl class="gmap__info-kv">
                    <dt>Position</dt>
                    <dd>
                      {fmtInt(f().start)}–{fmtInt(f().end)}
                      {f().start > f().end ? " (across the origin)" : ""}
                    </dd>
                    <dt>Length</dt>
                    <dd>{fmtBp(featureLength(f(), props.sizeBp))}</dd>
                    <dt>Strand</dt>
                    <dd>{f().type === "D-loop" ? "Non-coding" : strandText(f().strand)}</dd>
                    <Show when={gcOf(i()) !== undefined}>
                      <dt>GC content</dt>
                      <dd>{fmtPct(gcOf(i()), 1)}</dd>
                    </Show>
                  </dl>
                  <Show when={href(i())}>
                    {(h) => (
                      <a class="gmap__info-link" href={h()}>
                        {featureSymbol(f().name)} across all species
                        <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </a>
                    )}
                  </Show>
                </>
              );
            }}
          </Show>
        </div>

        <ul class="gmap__legend" role="list">
          <For each={TYPE_ORDER.filter((t) => (counts()[t] ?? 0) > 0)}>
            {(t) => (
              <li>
                <span class="gmap__swatch" style={{ "--sw": FEATURE_COLOR[t] }} />
                {KIND_PLURAL[t]}
                <span class="gmap__legend-n">{counts()[t]}</span>
              </li>
            )}
          </For>
        </ul>
        <ul class="gmap__keys" role="list">
          <li>
            <svg viewBox="0 0 40 16" aria-hidden="true" class="gmap__key-art">
              <path class="gmap__key-arrow" d="M2 2h28l7 6-7 6H2z" />
            </svg>
            Outer ring: + strand, arrows run clockwise. Inner ring: − strand.
          </li>
          <li>
            <svg viewBox="0 0 40 18" aria-hidden="true" class="gmap__key-art">
              <rect class="gmap__gc-bar is-up" x="3" y="2" width="9" height="7" />
              <rect class="gmap__gc-bar is-up" x="14" y="5" width="9" height="4" />
              <rect class="gmap__gc-bar is-down" x="25" y="9" width="9" height="7" />
              <path class="gmap__key-ref" d="M0 9h40" />
            </svg>
            <span>
              Middle ring: GC% of each gene against the whole genome ({fmtPct(props.genomeGc, 1)}, dashed): out is
              GC-richer, in is AT-richer (full height = {GC_SPAN} points).
            </span>
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}
