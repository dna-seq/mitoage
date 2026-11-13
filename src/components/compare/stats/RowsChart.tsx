/**
 * The chart of a comparative table: a range chart of the rows the table shows, on the axis the
 * reader picked (distribution, variation or correlation with lifespan). Used inside a DataTable's
 * `figure`, by the regions table and the taxa tables.
 *
 * Drawn in the browser only: the table under it already carries the numbers in the page, and the
 * SVG of two charts would add about 50 KB to every statistics page. Until the island hydrates a
 * placeholder holds the chart's height.
 */
import { createMemo, createSignal, onMount, Show } from "solid-js";
import RangePlot, { type GlyphKind } from "~/components/charts/RangePlot";
import type { Row } from "~/components/ui/DataTable";
import { rangeAxis, rangeMarks, type RangePlotKey, type Swatch } from "~/lib/compare/charts";
import { getParam, type ParamKey } from "~/lib/compare/params";
import { MIN_CORR_N } from "~/lib/compare/summary";

export interface RowsChartProps {
  rows: Row[];
  /** Rows of the whole table; when the page shows fewer, the chart says it follows the page. */
  total: number;
  plot: RangePlotKey;
  param: ParamKey;
  color: (row: Row) => string;
  /** Colour key; left out when the rows share one colour. */
  swatches: (rows: Row[]) => Swatch[];
  /** What the rows are, for the accessible name: "regions of all species", "orders of Mammalia". */
  what: string;
  /** Lengths that span orders of magnitude (the regions) go to a log axis. */
  allowLog?: boolean;
  showN?: boolean;
}

const GLYPHS: Record<RangePlotKey, (cv: boolean) => { kind: GlyphKind; label: string }[]> = {
  dist: () => [
    { kind: "line", label: "min to max" },
    { kind: "box", label: "mean ± SD" },
    { kind: "tick", label: "median" },
    { kind: "dot", label: "mean" },
  ],
  var: (cv) => [{ kind: "bar", label: cv ? "SD / mean" : "SD" }],
  r: () => [
    { kind: "dot", label: "r" },
    { kind: "line", label: "95% confidence interval" },
  ],
};

export default function RowsChart(props: RowsChartProps) {
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  const param = () => getParam(props.param);
  const marks = createMemo(() => rangeMarks(props.rows, props.plot, param(), props.color));
  const axis = createMemo(() => rangeAxis(marks(), props.plot, param(), props.allowLog));
  const swatches = createMemo(() => {
    const s = props.swatches(props.rows);
    return s.length > 1 ? s : [];
  });
  const note = () => {
    const parts: string[] = [];
    if (props.plot === "r") {
      parts.push(
        `Pearson r of ${param().noun} with log₁₀ maximum lifespan, for ${MIN_CORR_N} or more species. The intervals (Fisher z) are not corrected for multiple testing or shared ancestry.`,
      );
    }
    if (props.rows.length < props.total) parts.push("The chart shows the rows on this page of the table, in its order.");
    else if (props.total > 1) parts.push("Rows follow the order of the table: sort a column to reorder the chart.");
    return parts.join(" ");
  };
  const aria = () =>
    props.plot === "r"
      ? `Correlation of ${param().noun} with maximum lifespan: ${props.what}`
      : props.plot === "var"
        ? `Variation of ${param().noun}: ${props.what}`
        : `${param().noun.charAt(0).toUpperCase() + param().noun.slice(1)}: ${props.what}`;
  return (
    <Show
      when={mounted()}
      fallback={<div class="cs-chart-hold" style={{ "--rows": String(props.rows.length) }} aria-hidden="true" />}
    >
      <RangePlot
        marks={marks()}
        axis={axis()}
        glyphs={GLYPHS[props.plot](param().cv)}
        swatches={swatches()}
        showN={props.showN}
        ariaLabel={`${aria()}. The numbers are in the table below.`}
        note={note()}
      />
    </Show>
  );
}
