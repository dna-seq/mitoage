/**
 * Codon usage across a group: for all protein-coding genes or one gene, each codon's (or amino
 * acid's) frequency summarised over the group's species, as stacked rows by amino acid and as a
 * table. Data: /compare/codons/{group}.json, loaded when the island hydrates (the page renders
 * only the frame, to stay small). Mirrors ?gene=, ?usage=aa and ?bars=share in the query string.
 */
import { createEffect, createMemo, createSignal, on, onMount, Show } from "solid-js";
import DataTable, { type Row } from "~/components/ui/DataTable";
import type { Region } from "~/data/schema";
import { codonBarRows } from "~/lib/compare/charts";
import { loadGroupCodons, queryParam, setQuery } from "~/lib/compare/client";
import { CODON_REGIONS, regionFromSlug, regionSlug, statsRegionLabel } from "~/lib/compare/params";
import { type CodonMode, codonColumns, codonRows } from "~/lib/compare/rows";
import type { GroupCodonsFile } from "~/lib/compare/wire";
import CodonBars, { type CodonScale } from "./CodonBars";
import { RegionSelect } from "./Controls";

export interface CodonStatsProps {
  groupKey: string;
  groupName: string;
}

const DEFAULT_GENE: Region = "total_pc";

export default function CodonStats(props: CodonStatsProps) {
  const [gene, setGene] = createSignal<Region>(DEFAULT_GENE);
  const [mode, setMode] = createSignal<CodonMode>("codon");
  const [shown, setShown] = createSignal<{ gene: Region; mode: CodonMode } | null>(null);
  const [rows, setRows] = createSignal<Row[]>([]);
  const [file, setFile] = createSignal<GroupCodonsFile | null>(null);
  const [scale, setScale] = createSignal<CodonScale>("usage");
  const [status, setStatus] = createSignal("Loading codon usage…");
  const [ready, setReady] = createSignal(false);

  onMount(() => {
    const g = regionFromSlug(queryParam("gene") ?? "");
    if (g && CODON_REGIONS.includes(g)) setGene(g);
    if (queryParam("usage") === "aa") setMode("aa");
    if (queryParam("bars") === "share") setScale("share");
    setReady(true);
  });

  createEffect(
    on([gene, mode, ready], ([g, m, r]) => {
      if (!r) return;
      setQuery({ gene: g === DEFAULT_GENE ? null : regionSlug(g), usage: m === "codon" ? null : m });
      const cur = shown();
      if (cur && cur.gene === g && cur.mode === m) return;
      setStatus("Loading…");
      loadGroupCodons(props.groupKey)
        .then((file) => {
          setFile(file);
          setRows(codonRows(file, g, m));
          setShown({ gene: g, mode: m });
          setStatus("");
        })
        .catch((e: unknown) => setStatus(`Could not load the data (${e instanceof Error ? e.message : String(e)}).`));
    }),
  );

  createEffect(on(scale, (s) => setQuery({ bars: s === "usage" ? null : s }), { defer: true }));

  const view = () => shown() ?? { gene: gene(), mode: mode() };
  const bars = createMemo(() => {
    const f = file();
    const v = shown();
    return f && v ? codonBarRows(f, v.gene) : [];
  });
  const label = () => (view().gene === "total_pc" ? "all 13 protein-coding genes" : view().gene);
  return (
    <section class="card cs-card" id="codons" aria-labelledby="codons-title">
      <div class="card__head cs-card__head">
        <h2 id="codons-title" class="card__title">
          Codon usage
        </h2>
        <span class="card__desc">
          {view().mode === "codon" ? "Share of each codon" : "Share of each amino acid"} in {label()}, across{" "}
          {props.groupName}
        </span>
      </div>
      <div class="cs-controls">
        <RegionSelect id="codons" label="Gene" value={gene()} onChange={setGene} regions={CODON_REGIONS} />
        <div class="seg" role="group" aria-label="Codons or amino acids">
          <button type="button" class="seg__btn" aria-pressed={mode() === "codon"} onClick={() => setMode("codon")}>
            Codons
          </button>
          <button type="button" class="seg__btn" aria-pressed={mode() === "aa"} onClick={() => setMode("aa")}>
            Amino acids
          </button>
        </div>
      </div>
      <p class="cs-status" aria-live="polite">
        {status()}
      </p>
      <Show when={shown()}>
      <CodonBars rows={bars()} scale={scale()} onScale={setScale} what={label()} />
      <DataTable
        caption={`${view().mode === "codon" ? "Codon" : "Amino acid"} usage in ${statsRegionLabel(view().gene)}`}
        columns={codonColumns(view().mode)}
        rows={rows()}
        initialSort={{ key: "mean", dir: "desc" }}
        pageSize={0}
        csv={{ filename: `mitoage-${props.groupKey}-${view().mode === "codon" ? "codons" : "amino-acids"}-${regionSlug(view().gene)}.csv` }}
        noun={view().mode === "codon" ? ["codon", "codons"] : ["amino acid", "amino acids"]}
      />
      </Show>
    </section>
  );
}
