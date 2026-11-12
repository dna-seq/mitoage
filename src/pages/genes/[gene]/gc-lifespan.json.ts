/**
 * GC% of one gene (y) against maximum lifespan (x) for every species, in the columnar
 * ScatterPayload format, for the scatter plot on /genes/{gene}/ (fetched when it scrolls into view).
 */
import type { APIRoute, GetStaticPaths } from "astro";
import type { Region } from "~/data/schema";
import { GENE_PAGE_REGIONS } from "~/lib/genes";
import { featureLifespanPoints } from "~/lib/genome/geneData";
import { pointsToPayload } from "~/lib/scatterTypes";
import { geneSlug } from "~/lib/urls";

export const getStaticPaths = (() =>
  GENE_PAGE_REGIONS.map((region) => ({ params: { gene: geneSlug(region) }, props: { region } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const region = (props as { region: Region }).region;
  const pts = featureLifespanPoints(`gc:${region}`).map(({ short: _short, ...p }) => p);
  return new Response(JSON.stringify(pointsToPayload(pts)), { headers: { "Content-Type": "application/json" } });
};
