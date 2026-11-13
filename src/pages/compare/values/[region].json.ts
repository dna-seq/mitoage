/** /compare/values/{region}.json: every species' base counts, skews and length for one region (see ~/lib/compare/wire). */
import type { APIRoute, GetStaticPaths } from "astro";
import type { Region } from "~/data";
import { regionValues } from "~/lib/compare/build";
import { regionSlug, STATS_REGIONS } from "~/lib/compare/params";

export const getStaticPaths = (() =>
  STATS_REGIONS.map((region) => ({ params: { region: regionSlug(region) }, props: { region } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(regionValues((props as { region: Region }).region)), {
    headers: { "Content-Type": "application/json" },
  });
