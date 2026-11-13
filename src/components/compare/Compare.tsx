/**
 * Compare island: 2-6 species side by side. Reads ?species=a,b,c, fetches /species/{slug}.json
 * for each, and keeps the query string in sync as species are added or removed. The genomes of
 * the chosen species download as one FASTA file, fetched from NCBI in the browser.
 *
 * <Compare client:idle suggestions={...} speciesCount={922} />
 */
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { ICONS } from "~/components/ui/icons";
import { PROTEIN_GENES, type Region, type RegionStats } from "~/data/schema";
import { classColor, classLabel } from "~/lib/classes";
import { compareFastaName, fastaChoice, leftOutSentence } from "~/lib/compare/speciesFasta";
import { basePercents, NUCLEOTIDES } from "~/lib/composition";
import {
  COMPARE_INDEX_URL,
  type CompareIndex,
  MAX_COMPARE,
  type SpeciesFile,
  speciesJsonUrl,
  type Suggestion,
} from "~/lib/explore/compareTypes";
import { fmtSignedTick } from "~/lib/explore/format";
import { codonAminoAcid } from "~/lib/explore/variables";
import { type DownloadNote, downloadFasta } from "~/lib/fastaDownload";
import { fmtBp, fmtFixed, fmtInt, fmtLifespan, fmtLifespanLong, fmtNum, fmtPct, fmtSigned } from "~/lib/format";
import { regionLabel } from "~/lib/genes";
import { AMINO_ACIDS, CODONS } from "~/lib/geneticCode";
import { TRAIT_DEFS } from "~/lib/traits";
import { href } from "~/lib/url";
import { compareUrl, exploreUrl, geneUrl, speciesUrl } from "~/lib/urls";
import SpeciesCombobox, { type SpeciesItem } from "~/components/explore/SpeciesCombobox";
import DotPlot from "./DotPlot";
import { Marker, seriesColor, SERIES_COUNT } from "./Marker";
// Styles: ./compare.css and ../explore/explorer.css, imported by the page.

interface Props {
  suggestions: Suggestion[];
  speciesCount: number;
}

type Entry = { status: "loading" } | { status: "error" } | { status: "ok"; data: SpeciesFile };
interface Loaded {
  slug: string;
  /** Series index: colour and marker shape. */
  i: number;
  d: SpeciesFile;
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const parseSlugs = (search: string): string[] =>
  (new URLSearchParams(search).get("species") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s, i, a) => SLUG.test(s) && a.indexOf(s) === i)
    .slice(0, MAX_COMPARE);

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

const region = (d: SpeciesFile, r: Region): RegionStats | undefined => d.regions.find((x) => x.region === r);
const display = (d: SpeciesFile) => d.species.commonName.trim() || d.species.scientificName;

interface Metric {
  key: string;
  label: string;
  get: (d: SpeciesFile) => number | null;
  fmt: (v: number) => string;
  /** Draw a bar proportional to the row maximum (positive quantities only). */
  bar?: boolean;
}

const lengthOf = (r: Region) => (d: SpeciesFile) => region(d, r)?.lengthBp ?? null;

const LIFE_METRICS: Metric[] = [
  { key: "life", label: "Maximum lifespan", get: (d) => d.species.maxLongevityYears, fmt: fmtLifespanLong, bar: true },
  ...TRAIT_DEFS.map((t) => ({
    key: t.key,
    label: t.label,
    get: (d: SpeciesFile) => d.species.traits[t.key],
    fmt: t.format,
    bar: t.key !== "bodyTemperatureK",
  })),
];

const GENOME_METRICS: Metric[] = [
  { key: "size", label: "mtDNA size", get: (d) => d.species.mtdnaSizeBp, fmt: fmtBp, bar: true },
  { key: "gc", label: "GC content", get: (d) => d.species.gcPercent, fmt: (v) => fmtPct(v, 2), bar: true },
  { key: "gcSkew", label: "GC skew", get: (d) => region(d, "total_mtDNA")?.gcSkew ?? null, fmt: (v) => fmtSigned(v, 3) },
  { key: "atSkew", label: "AT skew", get: (d) => region(d, "total_mtDNA")?.atSkew ?? null, fmt: (v) => fmtSigned(v, 3) },
  { key: "noncoding", label: "Non-coding DNA", get: (d) => d.species.nonCodingBp, fmt: fmtBp, bar: true },
  { key: "dloop", label: "D-loop", get: lengthOf("D_Loop"), fmt: fmtBp, bar: true },
  { key: "pc", label: "Protein-coding genes", get: lengthOf("total_pc"), fmt: fmtBp, bar: true },
  { key: "12s", label: "12S rRNA", get: lengthOf("rRNA-12S"), fmt: fmtBp, bar: true },
  { key: "16s", label: "16S rRNA", get: lengthOf("rRNA-16S"), fmt: fmtBp, bar: true },
  { key: "trna", label: "All tRNA genes", get: lengthOf("total_tRNA"), fmt: fmtBp, bar: true },
];

const COMP_REGIONS: Region[] = ["total_mtDNA", "total_pc", "rRNA-12S", "rRNA-16S", "total_tRNA", "D_Loop"];
const GENE_ROWS: Region[] = [...PROTEIN_GENES, "rRNA-12S", "rRNA-16S", "D_Loop"];

type GeneMetric = "gc" | "length" | "gcSkew" | "atSkew";
const GENE_METRICS: { k: GeneMetric; label: string; axis: string }[] = [
  { k: "gc", label: "GC %", axis: "GC content, %" },
  { k: "length", label: "Length", axis: "Length, bp" },
  { k: "gcSkew", label: "GC skew", axis: "GC skew (G − C) / (G + C)" },
  { k: "atSkew", label: "AT skew", axis: "AT skew (A − T) / (A + T)" },
];

let indexPromise: Promise<CompareIndex> | null = null;
const loadIndex = (): Promise<CompareIndex> => {
  if (!indexPromise) {
    indexPromise = fetch(COMPARE_INDEX_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<CompareIndex>;
      })
      .catch((e: unknown) => {
        indexPromise = null;
        throw e;
      });
  }
  return indexPromise;
};

export default function Compare(props: Props) {
  const [slugs, setSlugs] = createSignal<string[]>([]);
  const [ready, setReady] = createSignal(false);
  const [entries, setEntries] = createSignal(new Map<string, Entry>());
  const [colors, setColors] = createSignal(new Map<string, number>());
  const [index, setIndex] = createSignal<CompareIndex | null>(null);
  const [copied, setCopied] = createSignal("");
  const [geneMetric, setGeneMetric] = createSignal<GeneMetric>("gc");
  const [codonMode, setCodonMode] = createSignal<"codon" | "aa">("codon");
  let root: HTMLDivElement | undefined;

  onMount(() => {
    setSlugs(parseSlugs(window.location.search));
    setReady(true);
  });

  // Stable colour and shape per species while it stays in the comparison.
  createEffect(() => {
    const list = slugs();
    setColors((prev) => {
      const next = new Map<string, number>();
      for (const s of list) if (prev.has(s)) next.set(s, prev.get(s) as number);
      for (const s of list) {
        if (next.has(s)) continue;
        const used = new Set(next.values());
        let i = 0;
        while (used.has(i) && i < SERIES_COUNT) i++;
        next.set(s, i);
      }
      return next;
    });
  });

  createEffect(() => {
    for (const slug of slugs()) {
      if (entries().has(slug)) continue;
      setEntries((m) => new Map(m).set(slug, { status: "loading" }));
      fetch(speciesJsonUrl(slug))
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<SpeciesFile>;
        })
        .then((data) => setEntries((m) => new Map(m).set(slug, { status: "ok", data })))
        .catch(() => setEntries((m) => new Map(m).set(slug, { status: "error" })));
    }
  });

  createEffect(() => {
    if (!ready()) return;
    const url = slugs().length ? compareUrl(slugs()) : href("/compare/species/");
    if (url !== `${window.location.pathname}${window.location.search}`) history.replaceState(history.state, "", url);
  });

  /** When the focused control disappears (a removed card, the empty state), continue in the "Add" box. */
  const keepFocus = () =>
    window.setTimeout(() => {
      if (root?.contains(document.activeElement)) return;
      root?.querySelector<HTMLInputElement>(".cmp-card--add input, .cmp-combo input")?.focus();
    }, 0);
  const add = (slug: string) => {
    setSlugs((s) => (s.includes(slug) || s.length >= MAX_COMPARE ? s : [...s, slug]));
    keepFocus();
  };
  const remove = (slug: string) => {
    setSlugs((s) => s.filter((x) => x !== slug));
    keepFocus();
  };
  const setAll = (list: string[]) => {
    setSlugs(list.slice(0, MAX_COMPARE));
    root?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
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

  const comboItems = (): Promise<SpeciesItem[]> =>
    loadIndex().then((ix) => {
      setIndex(ix);
      return ix.s.map(([slug, name, common, ci, order, life]) => ({
        slug,
        name,
        common,
        meta: `${order} · ${fmtLifespan(life)}`,
        color: classColor(ix.classes[ci] ?? ""),
      }));
    });

  const colorOf = (slug: string) => colors().get(slug) ?? 0;
  const ok = createMemo<Loaded[]>(() =>
    slugs().flatMap((slug) => {
      const e = entries().get(slug);
      return e?.status === "ok" ? [{ slug, i: colorOf(slug), d: e.data }] : [];
    }),
  );
  const series = createMemo(() => ok().map((x) => ({ id: x.slug, label: x.d.species.scientificName, i: x.i })));
  const pending = () => slugs().some((s) => entries().get(s)?.status !== "ok" && entries().get(s)?.status !== "error");
  const full = () => slugs().length >= MAX_COMPARE;

  // ------------------------------------------------------------ FASTA of the chosen species
  const [fastaBusy, setFastaBusy] = createSignal(false);
  const [fastaNote, setFastaNote] = createSignal<DownloadNote | null>(null);
  let fastaStop: AbortController | undefined;
  onCleanup(() => fastaStop?.abort());
  // A note about one selection does not outlive it.
  createEffect(
    on(slugs, () => {
      if (!fastaBusy()) setFastaNote(null);
    }, { defer: true }),
  );
  /** The genomes of the chosen species, in the order of their cards. */
  const exportFasta = async () => {
    if (fastaBusy() || pending()) return;
    const choice = fastaChoice(
      slugs().map((slug) => {
        const e = entries().get(slug);
        return { slug, refseq: e?.status === "ok" ? e.data.species.refseq : null };
      }),
    );
    if (!choice.accessions.length) return;
    const leftOut = leftOutSentence(choice.leftOut);
    fastaStop = new AbortController();
    setFastaBusy(true);
    const said = await downloadFasta(choice.accessions, compareFastaName(choice.slugs), {
      signal: fastaStop.signal,
      onNote: setFastaNote,
      ...(leftOut ? { leftOut } : {}),
    });
    setFastaBusy(false);
    setFastaNote(said);
  };

  // One species: load the species list to suggest relatives.
  createEffect(() => {
    if (ready() && ok().length === 1 && !pending() && !index()) loadIndex().then(setIndex).catch(() => undefined);
  });

  // ------------------------------------------------------------ suggestions for one species
  const relatives = createMemo(() => {
    const ix = index();
    const one = ok()[0];
    if (!ix || !one || ok().length !== 1) return [];
    const sp = one.d.species;
    const rows = ix.s.filter((r) => !slugs().includes(r[0]));
    const picks: { slug: string; name: string; common: string; life: number; why: string; color: string }[] = [];
    const push = (r: (typeof rows)[number] | undefined, why: string) => {
      if (!r || picks.some((p) => p.slug === r[0])) return;
      picks.push({ slug: r[0], name: r[1], common: r[2], life: r[5], why, color: classColor(ix.classes[r[3]] ?? "") });
    };
    const byLife = (a: (typeof rows)[number], b: (typeof rows)[number]) => b[5] - a[5];
    const sameOrder = rows.filter((r) => r[4] === sp.taxonomy.order).sort(byLife);
    push(sameOrder[0], `${sp.taxonomy.order}: the longest-lived relative`);
    if (sameOrder.length > 1) push(sameOrder[sameOrder.length - 1], `${sp.taxonomy.order}: the shortest-lived relative`);
    const sameClass = rows.filter((r) => ix.classes[r[3]] === sp.taxonomy.class && r[4] !== sp.taxonomy.order).sort(byLife);
    push(sameClass[0], `Longest-lived of the ${classLabel(sp.taxonomy.class).toLowerCase()} outside ${sp.taxonomy.order}`);
    const life = sp.maxLongevityYears;
    const other = rows
      .filter((r) => ix.classes[r[3]] !== sp.taxonomy.class && r[5] > 0)
      .sort((a, b) => Math.abs(Math.log(a[5] / life)) - Math.abs(Math.log(b[5] / life)));
    push(other[0], `Similar lifespan, another class`);
    return picks.slice(0, 4);
  });

  // ------------------------------------------------------------ chart data
  const geneValues = createMemo(() => {
    const m = geneMetric();
    const out: Record<string, Record<string, number | null>> = {};
    for (const r of GENE_ROWS) {
      const row: Record<string, number | null> = {};
      for (const x of ok()) {
        const st = region(x.d, r);
        row[x.slug] = !st
          ? null
          : m === "gc"
            ? st.gcPercent
            : m === "length"
              ? st.lengthBp
              : m === "gcSkew"
                ? st.gcSkew
                : st.atSkew;
      }
      out[r] = row;
    }
    return out;
  });

  const geneFormat = (v: number) => {
    const m = geneMetric();
    return m === "gc" ? fmtPct(v, 1) : m === "length" ? fmtBp(v) : fmtSigned(v, 3);
  };
  const geneTick = (v: number) => {
    const m = geneMetric();
    return m === "gc" ? fmtNum(v, 1) : m === "length" ? fmtInt(v) : fmtSignedTick(v, 2);
  };

  /** Codon (or amino-acid) frequencies in all protein-coding genes, % of codons (or of sense codons). */
  const usage = createMemo(() => {
    const mode = codonMode();
    const keys = mode === "codon" ? CODONS : Object.keys(AMINO_ACIDS).filter((a) => a !== "*");
    const per: Record<string, Record<string, number | null>> = {};
    for (const k of keys) per[k] = {};
    for (const x of ok()) {
      const u = x.d.codonUsage.find((c) => c.region === "total_pc");
      const src = u ? (mode === "codon" ? u.counts : u.aminoAcids) : null;
      const total = src ? keys.reduce((s, k) => s + (src[k] ?? 0), 0) : 0;
      for (const k of keys) {
        const row = per[k] as Record<string, number | null>;
        row[x.slug] = src && total > 0 ? ((src[k] ?? 0) / total) * 100 : null;
      }
    }
    const spread = (k: string) => {
      const vs = Object.values(per[k] ?? {}).filter((v): v is number => v !== null);
      return vs.length > 1 ? Math.max(...vs) - Math.min(...vs) : 0;
    };
    const top = [...keys].sort((a, b) => spread(b) - spread(a)).slice(0, mode === "codon" ? 12 : 10);
    return {
      rows: top.map((k) => ({
        key: k,
        label: mode === "codon" ? `${k} ${codonAminoAcid(k)}` : (AMINO_ACIDS[k]?.three ?? k),
      })),
      values: per,
    };
  });

  const rowMax = (m: Metric) => Math.max(0, ...ok().map((x) => m.get(x.d) ?? 0));

  const MetricRows = (p: { title: string; metrics: Metric[] }) => (
    <>
      <tr class="cmp-table__group">
        <th scope="rowgroup" colSpan={ok().length + 1}>
          {p.title}
        </th>
      </tr>
      <For each={p.metrics.filter((m) => ok().some((x) => m.get(x.d) !== null))}>
        {(m) => (
          <tr>
            <th scope="row">{m.label}</th>
            <For each={ok()}>
              {(x) => {
                const v = m.get(x.d);
                return (
                  <td>
                    <span class="cmp-val">{v === null ? "–" : m.fmt(v)}</span>
                    <Show when={m.bar && v !== null && v > 0}>
                      <span class="cmp-bar" aria-hidden="true">
                        <span style={{ width: `${Math.max(2, ((v ?? 0) / (rowMax(m) || 1)) * 100)}%`, background: seriesColor(x.i) }} />
                      </span>
                    </Show>
                  </td>
                );
              }}
            </For>
          </tr>
        )}
      </For>
    </>
  );

  return (
    <div class="cmp" ref={root} data-ready={ready() ? "" : undefined}>
      {/* ---------------------------------------------------- toolbar */}
      <Show when={slugs().length > 0}>
        <div class="cmp-toolbar">
          <p class="cmp-toolbar__count">
            Comparing <strong>{slugs().length}</strong> of up to {MAX_COMPARE} species
          </p>
          <div class="cmp-toolbar__actions">
            <span class="xp-copied" role="status">
              {copied()}
            </span>
            <Show when={ok().length > 0}>
              <a class="btn btn--soft btn--sm" href={exploreUrl({ highlight: ok().map((x) => x.slug).join(",") })}>
                Show in the plot
              </a>
              <button
                type="button"
                class="btn btn--soft btn--sm dtable__csv"
                disabled={fastaBusy() || pending()}
                aria-busy={fastaBusy() ? "true" : undefined}
                onClick={exportFasta}
              >
                <Svg name="download" size={16} />
                {ok().length === 1 ? "FASTA of this species" : "FASTA of these species"}
              </button>
            </Show>
            <button type="button" class="btn btn--soft btn--sm" onClick={() => setSlugs([])}>
              Clear
            </button>
            <button type="button" class="btn btn--primary btn--sm" onClick={copyLink}>
              Copy link
            </button>
          </div>
          <p class="dtable__note cmp-toolbar__note" role="status" data-tone={fastaNote()?.tone}>
            {fastaNote()?.text}
          </p>
        </div>
      </Show>

      {/* ---------------------------------------------------- species cards */}
      <Show when={slugs().length > 0}>
        <ul role="list" class="cmp-cards" aria-label="Species being compared">
          <For each={slugs()}>
            {(slug) => {
              const e = () => entries().get(slug);
              return (
                <li class="cmp-card" style={{ "--series": seriesColor(colorOf(slug)) }}>
                  <Show
                    when={e()?.status === "ok" ? (e() as { status: "ok"; data: SpeciesFile }).data : null}
                    fallback={
                      <div class="cmp-card__state">
                        <Show when={e()?.status === "error"} fallback={<span class="cmp-card__loading">Loading {slug}…</span>}>
                          <span>
                            No species called <code>{slug}</code>.
                          </span>
                        </Show>
                        <button type="button" class="cmp-card__x" aria-label={`Remove ${slug}`} onClick={() => remove(slug)}>
                          <Svg name="close" size={18} />
                        </button>
                      </div>
                    }
                  >
                    {(d) => (
                      <>
                        <div class="cmp-card__top">
                          <Marker i={colorOf(slug)} size={20} />
                          <button
                            type="button"
                            class="cmp-card__x"
                            aria-label={`Remove ${d().species.scientificName}`}
                            onClick={() => remove(slug)}
                          >
                            <Svg name="close" size={18} />
                          </button>
                        </div>
                        <h3 class="cmp-card__name">
                          <a href={speciesUrl(slug)}>
                            <i>{d().species.scientificName}</i>
                          </a>
                        </h3>
                        <p class="cmp-card__common">{d().species.commonName || " "}</p>
                        <span class="cmp-card__class" style={{ "--dot": classColor(d().species.taxonomy.class) }}>
                          <span class="cmp-card__dot" aria-hidden="true" />
                          {classLabel(d().species.taxonomy.class)}
                          <span class="cmp-card__order">· {d().species.taxonomy.order}</span>
                        </span>
                        <dl class="cmp-card__stats">
                          <div>
                            <dt>mtDNA</dt>
                            <dd>{fmtInt(d().species.mtdnaSizeBp)} bp</dd>
                          </div>
                          <div>
                            <dt>GC</dt>
                            <dd>{fmtFixed(d().species.gcPercent, 1)}%</dd>
                          </div>
                          <div>
                            <dt>Lifespan</dt>
                            <dd>{fmtLifespan(d().species.maxLongevityYears)}</dd>
                          </div>
                        </dl>
                      </>
                    )}
                  </Show>
                </li>
              );
            }}
          </For>
          <Show when={!full()}>
            <li class="cmp-card cmp-card--add">
              <p class="cmp-card__add-title">
                <Svg name="plus" size={20} /> Add a species
              </p>
              <SpeciesCombobox
                load={comboItems}
                onSelect={add}
                exclude={new Set(slugs())}
                placeholder="Name or common name"
                label="Add a species to the comparison"
                class="cmp-combo"
              />
              <p class="cmp-card__hint">Up to {MAX_COMPARE} species</p>
            </li>
          </Show>
        </ul>
      </Show>

      {/* ---------------------------------------------------- empty state */}
      <Show when={slugs().length === 0}>
        <section class="card cmp-empty" aria-labelledby="cmp-empty-title">
          <div class="cmp-empty__intro">
            <h2 id="cmp-empty-title" class="card__title">
              Pick species to compare
            </h2>
            <p class="card__desc">
              Search any of the {fmtInt(props.speciesCount)} species, or start from one of these comparisons.
            </p>
            <SpeciesCombobox
              load={comboItems}
              onSelect={add}
              placeholder="Search a species, e.g. bowhead whale"
              label="Search a species to compare"
              class="cmp-combo cmp-combo--big"
            />
          </div>
          <ul role="list" class="cmp-suggest">
            <For each={props.suggestions}>
              {(s) => (
                <li>
                  <a
                    class="cmp-suggest__item"
                    href={s.href}
                    onClick={(e) => {
                      e.preventDefault();
                      setAll(s.species.map((x) => x.slug));
                    }}
                  >
                    <span class="cmp-suggest__title">{s.title}</span>
                    <span class="cmp-suggest__why">{s.why}</span>
                    <span class="cmp-suggest__species">
                      <For each={s.species}>
                        {(x) => (
                          <span class="cmp-suggest__sp">
                            <span class="cmp-card__dot" style={{ "--dot": x.color }} aria-hidden="true" />
                            {x.common || <i>{x.name}</i>}
                            <span class="cmp-suggest__life">{x.lifespan}</span>
                          </span>
                        )}
                      </For>
                    </span>
                  </a>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      {/* ---------------------------------------------------- one species */}
      <Show when={ok().length === 1 && !pending()}>
        <section class="card cmp-one" aria-labelledby="cmp-one-title">
          <h2 id="cmp-one-title" class="card__title">
            Add another species to compare {display((ok()[0] as Loaded).d)} with
          </h2>
          <p class="card__desc">Use the search in the card above, or pick one of these:</p>
          <ul role="list" class="cmp-rel">
            <For each={relatives()} fallback={<li class="muted">Finding relatives…</li>}>
              {(r) => (
                <li>
                  <button type="button" class="cmp-rel__btn" onClick={() => add(r.slug)}>
                    <span class="cmp-card__dot" style={{ "--dot": r.color }} aria-hidden="true" />
                    <span class="cmp-rel__text">
                      <span class="cmp-rel__name">
                        {r.common || <i>{r.name}</i>} <span class="cmp-rel__life">{fmtLifespan(r.life)}</span>
                      </span>
                      <span class="cmp-rel__why">{r.why}</span>
                    </span>
                    <Svg name="plus" size={18} />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <Show when={pending() && ok().length < 2 && slugs().length > 1}>
        <p class="cmp-loading" role="status">
          Loading species…
        </p>
      </Show>

      {/* ---------------------------------------------------- comparison */}
      <Show when={ok().length >= 2}>
        <section class="card cmp-section" aria-labelledby="cmp-table-title">
          <div class="card__head">
            <h2 id="cmp-table-title" class="card__title">
              Mitochondrial genome
            </h2>
            <span class="card__desc">Bars compare each row with its largest value</span>
          </div>
          <div class="cmp-scroll" tabIndex={0} role="region" aria-labelledby="cmp-table-title">
            <table class="cmp-table">
              <caption class="visually-hidden">Taxonomy and mitochondrial genome statistics of the compared species</caption>
              <thead>
                <tr>
                  <td />
                  <For each={ok()}>
                    {(x) => (
                      <th scope="col">
                        <span class="cmp-th">
                          <Marker i={x.i} size={16} />
                          <span>
                            {display(x.d)}
                            <Show when={x.d.species.commonName}>
                              <span class="cmp-th__sci">{x.d.species.scientificName}</span>
                            </Show>
                          </span>
                        </span>
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <tr class="cmp-table__group">
                  <th scope="rowgroup" colSpan={ok().length + 1}>
                    Taxonomy
                  </th>
                </tr>
                <tr>
                  <th scope="row">Class</th>
                  <For each={ok()}>{(x) => <td>{classLabel(x.d.species.taxonomy.class)}</td>}</For>
                </tr>
                <tr>
                  <th scope="row">Order</th>
                  <For each={ok()}>{(x) => <td>{x.d.species.taxonomy.order}</td>}</For>
                </tr>
                <tr>
                  <th scope="row">Family</th>
                  <For each={ok()}>{(x) => <td>{x.d.species.taxonomy.family}</td>}</For>
                </tr>
                <MetricRows title="Mitochondrial genome" metrics={GENOME_METRICS} />
              </tbody>
            </table>
          </div>
        </section>

        <section class="card cmp-section" aria-labelledby="cmp-comp-title">
          <div class="card__head">
            <h2 id="cmp-comp-title" class="card__title">
              Base composition by region
            </h2>
            <ul class="comp-legend" aria-label="Nucleotide colours">
              <For each={NUCLEOTIDES.filter((n) => n.key !== "other")}>
                {(n) => (
                  <li>
                    <span class={`comp-legend__swatch ${n.className}`} />
                    <span class="comp-legend__base">{n.label}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>
          <p class="card__desc">Reference (L) strand as deposited in RefSeq. GC % is on the right.</p>
          <div class="cmp-comp">
            <For each={COMP_REGIONS}>
              {(r) => (
                <div class="cmp-comp__region">
                  <h3 class="cmp-comp__title">{regionLabel(r)}</h3>
                  <For each={ok()}>
                    {(x) => {
                      const st = region(x.d, r);
                      const pct = st ? basePercents(st) : null;
                      return (
                        <div class="cmp-comp__row">
                          <span class="cmp-comp__who">
                            <Marker i={x.i} size={14} />
                            <span>{display(x.d)}</span>
                          </span>
                          <Show when={st && pct} fallback={<span class="cmp-comp__na">Not annotated</span>}>
                            <div
                              class="comp-bar"
                              role="img"
                              aria-label={`${display(x.d)}, ${regionLabel(r)}: ${NUCLEOTIDES.filter((n) => n.key !== "other")
                                .map((n) => `${n.label} ${fmtFixed(pct?.[n.key] ?? 0, 1)}%`)
                                .join(", ")}`}
                            >
                              <For each={NUCLEOTIDES}>
                                {(n) => (
                                  <Show when={(pct?.[n.key] ?? 0) > 0}>
                                    <span class={`comp-bar__seg ${n.className}`} style={{ width: `${(pct?.[n.key] ?? 0).toFixed(3)}%` }} />
                                  </Show>
                                )}
                              </For>
                            </div>
                            <span class="cmp-comp__gc">{fmtFixed(st?.gcPercent ?? 0, 1)}%</span>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              )}
            </For>
          </div>
        </section>

        <section class="card cmp-section" aria-labelledby="cmp-genes-title">
          <div class="card__head">
            <h2 id="cmp-genes-title" class="card__title">
              Gene by gene
            </h2>
            <div class="seg" role="group" aria-label="Measure">
              <For each={GENE_METRICS}>
                {(m) => (
                  <button type="button" class="seg__btn" aria-pressed={geneMetric() === m.k} onClick={() => setGeneMetric(m.k)}>
                    {m.label}
                  </button>
                )}
              </For>
            </div>
          </div>
          <p class="card__desc">The 13 protein-coding genes, both rRNAs and the D-loop. Hover or tap a marker for its value.</p>
          <SeriesLegend items={ok()} />
          <DotPlot
            rows={GENE_ROWS.map((r) => ({ key: r, label: regionLabel(r), href: geneUrl(r) }))}
            series={series()}
            values={geneValues()}
            format={geneFormat}
            tick={geneTick}
            axisLabel={GENE_METRICS.find((m) => m.k === geneMetric())?.axis ?? ""}
            ariaLabel={`Dot plot of ${GENE_METRICS.find((m) => m.k === geneMetric())?.axis ?? ""} per gene for ${ok()
              .map((x) => x.d.species.scientificName)
              .join(", ")}`}
            caption="Values per gene"
            includeZero={geneMetric() === "gcSkew" || geneMetric() === "atSkew"}
          />
        </section>

        <section class="card cmp-section" aria-labelledby="cmp-codon-title">
          <div class="card__head">
            <h2 id="cmp-codon-title" class="card__title">
              Where codon usage differs most
            </h2>
            <div class="seg" role="group" aria-label="Codons or amino acids">
              <button type="button" class="seg__btn" aria-pressed={codonMode() === "codon"} onClick={() => setCodonMode("codon")}>
                Codons
              </button>
              <button type="button" class="seg__btn" aria-pressed={codonMode() === "aa"} onClick={() => setCodonMode("aa")}>
                Amino acids
              </button>
            </div>
          </div>
          <p class="card__desc">
            {codonMode() === "codon"
              ? "The 12 codons whose share of all codons in the 13 protein-coding genes varies most between these species. Amino acids follow the vertebrate mitochondrial code."
              : "The 10 amino acids whose share of the encoded protein varies most between these species."}
          </p>
          <SeriesLegend items={ok()} />
          <DotPlot
            rows={usage().rows}
            series={series()}
            values={usage().values}
            format={(v) => fmtPct(v, 2)}
            tick={(v) => fmtNum(v, 1)}
            axisLabel={codonMode() === "codon" ? "% of codons" : "% of amino acids"}
            ariaLabel={`Dot plot of the ${codonMode() === "codon" ? "codons" : "amino acids"} whose usage differs most between the compared species`}
            caption={codonMode() === "codon" ? "Codon usage, % of codons" : "Amino-acid usage, %"}
            includeZero
          />
        </section>

        <section class="card cmp-section" aria-labelledby="cmp-life-title">
          <div class="card__head">
            <h2 id="cmp-life-title" class="card__title">
              Life history
            </h2>
            <span class="card__desc">From AnAge; bars compare each row with its largest value</span>
          </div>
          <div class="cmp-scroll" tabIndex={0} role="region" aria-labelledby="cmp-life-title">
            <table class="cmp-table">
              <caption class="visually-hidden">Life-history traits of the compared species</caption>
              <thead>
                <tr>
                  <td />
                  <For each={ok()}>
                    {(x) => (
                      <th scope="col">
                        <span class="cmp-th">
                          <Marker i={x.i} size={16} />
                          <span>{display(x.d)}</span>
                        </span>
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <MetricRows title="Life history" metrics={LIFE_METRICS} />
              </tbody>
            </table>
          </div>
        </section>
      </Show>
    </div>
  );
}

function SeriesLegend(p: { items: Loaded[] }) {
  return (
    <ul class="cmp-legend" aria-label="Species">
      <For each={p.items}>
        {(x) => (
          <li>
            <Marker i={x.i} size={16} />
            <i>{x.d.species.scientificName}</i>
          </li>
        )}
      </For>
    </ul>
  );
}
