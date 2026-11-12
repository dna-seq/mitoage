/**
 * GC% against lifespan for every species with one clade highlighted. Scatter fetches the
 * shared dataset (dataUrl, /species/gc-lifespan.json) and merges the clade's ids over it, so
 * the clade's points take the "clade" group and its colour while the rest stay muted.
 * Small clades pass their species slugs inline (`ids`); large ones pass `cladeKey` and the
 * ids come from the shared tree data, which keeps the HTML small.
 *
 * <CladeScatter client:visible ids="homo-sapiens,pan-troglodytes" count={2}
 *   color="var(--class-mammalia)" cladeLabel="Hominidae" dataUrl={GC_LIFESPAN_URL} ... />
 */
import { createMemo, createSignal, onMount } from "solid-js";
import Scatter, { type ScatterProps } from "~/components/charts/Scatter";
import type { ScatterPoint } from "~/lib/scatterTypes";
import { loadTree } from "~/lib/tree/data";
import { parseKey } from "~/lib/tree/types";

export interface CladeScatterProps extends Omit<ScatterProps, "points" | "groups" | "emphasizeGroup" | "legend" | "labelIds"> {
  /** Comma-separated slugs of the clade's species (small clades). */
  ids?: string;
  /** "rank:slug" of the clade, to read its species from the tree data (large clades). */
  cladeKey?: string;
  /** Number of species in the clade (legend). */
  count: number;
  /** CSS colour of the clade's points. */
  color: string;
  /** Legend label for the clade, e.g. "Primates". */
  cladeLabel: string;
  /** Points to label, with their short label (e.g. the common name). */
  labels?: { id: string; short: string }[];
}

const CLADE = "clade";

export default function CladeScatter(props: CladeScatterProps) {
  const [ids, setIds] = createSignal<string[]>((props.ids ?? "").split(",").filter(Boolean));

  onMount(() => {
    if (props.ids || !props.cladeKey) return;
    const k = parseKey(props.cladeKey);
    if (!k) return;
    loadTree()
      .then((m) => {
        const node = m.byKey.get(`${k[0]}:${k[1]}`);
        if (node) setIds(node.leaves().map((l) => l.data.slug));
      })
      .catch(() => {
        // Without the tree data the plot still shows every species, unhighlighted.
      });
  });

  // Partial points: only id and group (plus a short label). Scatter merges them over the full
  // dataset by id once it has loaded; until then they have no coordinates and are not drawn.
  const points = createMemo(() => {
    const short = new Map((props.labels ?? []).map((l) => [l.id, l.short] as const));
    return ids().map((id) => {
      const p: Record<string, string> = { id, group: CLADE };
      const s = short.get(id);
      if (s) p["short"] = s;
      return p as unknown as ScatterPoint;
    });
  });
  const labelIds = () => (props.labels ?? []).map((l) => l.id);

  return (
    <Scatter
      {...props}
      points={points()}
      groups={[{ key: CLADE, label: props.cladeLabel, color: props.color }]}
      emphasizeGroup={CLADE}
      labelIds={labelIds()}
      legend={[
        { label: `${props.cladeLabel} (${props.count.toLocaleString("en-US")})`, color: props.color, group: CLADE },
        { label: "Other species", color: "var(--chart-point-muted)" },
      ]}
    />
  );
}
