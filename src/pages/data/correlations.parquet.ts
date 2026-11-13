/**
 * /data/correlations.parquet: every correlation row of every dataset, computed during the site build
 * from the committed parquet (decision D3), not committed. Columns as in the downloads README.
 */
import type { APIRoute } from "astro";
import { parquetBuffer } from "../../../pipeline/lib/parquet";
import { getAllCorrelationRows, getBuildInfo } from "~/data";

export const GET: APIRoute = () => {
  const cs = getAllCorrelationRows();
  const info = getBuildInfo();
  const sets = new Map((info.correlationDatasets ?? []).map((d) => [d.dataset, d]));
  const n = (v: number | null | undefined) => (v === undefined || v === null || !Number.isFinite(v) ? null : v);
  const buf = parquetBuffer([
    { name: "build", type: "INT32", data: cs.map(() => info.buildNumber ?? null) },
    { name: "dataset", type: "STRING", data: cs.map((c) => c.dataset ?? "default") },
    { name: "filters", type: "STRING", data: cs.map((c) => sets.get(c.dataset ?? "default")?.filters ?? null) },
    { name: "lifespan_sources", type: "STRING", data: cs.map((c) => sets.get(c.dataset ?? "default")?.lifespanSources.join("; ") ?? null) },
    { name: "feature_key", type: "STRING", data: cs.map((c) => c.featureKey) },
    { name: "trait", type: "STRING", data: cs.map((c) => c.trait) },
    { name: "scope", type: "STRING", data: cs.map((c) => c.scope) },
    { name: "n", type: "INT32", data: cs.map((c) => c.n) },
    { name: "pearson_r", type: "DOUBLE", data: cs.map((c) => n(c.pearsonR)) },
    { name: "spearman_rho", type: "DOUBLE", data: cs.map((c) => n(c.spearmanRho)) },
    { name: "p_value", type: "DOUBLE", data: cs.map((c) => n(c.pValue)) },
    { name: "q_value", type: "DOUBLE", data: cs.map((c) => n(c.qValue)) },
    { name: "partial_r", type: "DOUBLE", data: cs.map((c) => n(c.partialR)) },
    { name: "partial_p_value", type: "DOUBLE", data: cs.map((c) => n(c.partialPValue)) },
    { name: "partial_n", type: "INT32", data: cs.map((c) => c.partialN ?? null) },
    { name: "pic_r", type: "DOUBLE", data: cs.map((c) => n(c.picR)) },
    { name: "pic_p_value", type: "DOUBLE", data: cs.map((c) => n(c.picPValue)) },
  ]);
  return new Response(buf, { headers: { "Content-Type": "application/vnd.apache.parquet" } });
};
