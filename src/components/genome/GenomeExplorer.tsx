/**
 * Circular genome map with a species switch (genes index and gene pages). The first species is
 * drawn at build time; picking another loads /species/{slug}.json and redraws the same map, with
 * the gene of the page still highlighted. The species is kept in ?species= so a view is a link.
 * Styles: ./genome.css (imported by the page).
 *
 * <GenomeExplorer client:idle id="genes-map" initial={mapDataFor(ref)} quick={QUICK_MAP_SPECIES} />
 */
import { createSignal, For, onMount, Show } from "solid-js";
import SpeciesCombobox, { type SpeciesItem } from "~/components/explore/SpeciesCombobox";
import { classColor } from "~/lib/classes";
import { queryParam, setQuery } from "~/lib/compare/client";
import { type CompareIndex, COMPARE_INDEX_URL, type SpeciesFile, speciesJsonUrl } from "~/lib/explore/compareTypes";
import { fmtBp, fmtInt, fmtLifespan, fmtPct } from "~/lib/format";
import { featureLength } from "~/lib/genome/layout";
import { buildMapData, type MapData } from "~/lib/genome/mapClient";
import { featureSymbol } from "~/lib/genome/names";
import { speciesUrl } from "~/lib/urls";
import GenomeMap from "./GenomeMap";

export interface GenomeExplorerProps {
  id: string;
  initial: MapData;
  /** Region drawn in full colour while the others are muted (gene pages), with its symbol. */
  highlight?: { region: string; symbol: string };
  quick?: readonly { slug: string; label: string }[];
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

let indexPromise: Promise<SpeciesItem[]> | null = null;
const loadItems = (): Promise<SpeciesItem[]> => {
  indexPromise ??= fetch(COMPARE_INDEX_URL)
    .then((r) => (r.ok ? (r.json() as Promise<CompareIndex>) : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((ix) =>
      ix.s.map(([slug, name, common, ci, order, life]) => ({
        slug,
        name,
        common,
        meta: `${order} · ${fmtLifespan(life)}`,
        color: classColor(ix.classes[ci] ?? ""),
      })),
    )
    .catch((e: unknown) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
};

export default function GenomeExplorer(props: GenomeExplorerProps) {
  const [data, setData] = createSignal<MapData>(props.initial);
  const [loading, setLoading] = createSignal("");
  const [error, setError] = createSignal("");

  const show = (slug: string) => {
    if (slug === data().slug) return;
    setLoading(slug);
    setError("");
    fetch(speciesJsonUrl(slug))
      .then((r) => (r.ok ? (r.json() as Promise<SpeciesFile>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((file) => {
        setData(buildMapData(file));
        setQuery({ species: slug === props.initial.slug ? null : slug });
      })
      .catch(() => setError(`Could not load the genome of ${slug}.`))
      .finally(() => setLoading(""));
  };

  onMount(() => {
    const s = (queryParam("species") ?? "").trim().toLowerCase();
    if (s && SLUG.test(s)) show(s);
  });

  const hl = () => props.highlight;
  const feat = () => {
    const h = hl();
    return h ? data().features.find((f) => f.name === h.region) : undefined;
  };
  const display = () => data().common || data().name;

  return (
    <div class="gx">
      <div class="card__head gx__head">
        <div class="gx__titles">
          <p class="gx__kicker">{hl() ? `${hl()!.symbol} in the mitochondrial genome of` : "The mitochondrial genome of"}</p>
          <h2 id={`${props.id}-title`} class="card__title gx__title">
            <Show when={data().common} fallback={<i>{data().name}</i>}>
              {data().common} <i class="gx__sci">{data().name}</i>
            </Show>
          </h2>
          <p class="card__desc gx__desc">
            RefSeq {data().refseq} · {fmtBp(data().sizeBp)} · GC {fmtPct(data().genomeGc, 1)}
            <Show when={hl()}>
              {" · "}
              <Show when={feat()} fallback={<>{hl()!.symbol} is not annotated in this record</>}>
                {(f) =>
                  `${hl()!.symbol} at ${fmtInt(f().start)}–${fmtInt(f().end)}, ${fmtBp(featureLength(f(), data().sizeBp))}${
                    f().type === "D-loop" ? "" : `, ${f().strand === 1 ? "+" : "−"} strand`
                  }`
                }
              </Show>
            </Show>
            {" · "}
            <a href={speciesUrl(data().slug)}>Species page</a>
          </p>
        </div>
      </div>

      <div class="gx__controls">
        <SpeciesCombobox
          load={loadItems}
          onSelect={show}
          exclude={new Set([data().slug])}
          placeholder="Show another species"
          label="Show the mitochondrial genome of another species"
          class="gx__combo"
        />
        <Show when={props.quick?.length}>
          <div class="gx__quick" role="group" aria-label="Quick picks">
            <For each={props.quick}>
              {(q) => (
                <button
                  type="button"
                  class={`chip ${data().slug === q.slug ? "chip--current" : "chip--soft"}`}
                  aria-pressed={data().slug === q.slug}
                  onClick={() => show(q.slug)}
                >
                  {q.label}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      <p class="gx__status" aria-live="polite">
        {loading() ? `Loading ${loading()}…` : error()}
      </p>

      <div class="gmapfig" classList={{ "gx--loading": loading() !== "" }}>
        <Show when={data()} keyed>
          {(d) =>
            d.features.length === 0 ? (
              <div class="empty">
                <p>
                  The RefSeq record of <i>{d.name}</i> ({d.refseq}) has no annotated genes, so there is no map to draw.
                </p>
              </div>
            ) : (
              <GenomeMap
                id={props.id}
                features={d.features}
                sizeBp={d.sizeBp}
                gc={d.gc}
                genomeGc={d.genomeGc}
                name={d.name}
                {...(hl() ? { highlight: hl()!.region } : {})}
                label={`Circular map of the mitochondrial genome of ${display()}${hl() ? ` with ${hl()!.symbol} highlighted` : ""}; every gene links to its page`}
              />
            )
          }
        </Show>
        <Show when={data().omitted.length > 0}>
          <p class="gmap-note">
            Not drawn:{" "}
            {data()
              .omitted.map((f) => `${featureSymbol(f.name)} ${fmtInt(f.start)}–${fmtInt(f.end)}`)
              .join(", ")}
            , annotated over most of the record.
          </p>
        </Show>
      </div>
    </div>
  );
}
