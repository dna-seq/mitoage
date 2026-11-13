/** /compare/stats/{group}.json: summaries of every region and parameter in one group (see ~/lib/compare/wire). */
import type { APIRoute, GetStaticPaths } from "astro";
import { groupStats, type StatsGroup, statsGroups } from "~/lib/compare/build";

export const getStaticPaths = (() =>
  statsGroups().map((group) => ({ params: { group: group.key }, props: { group } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(groupStats((props as { group: StatsGroup }).group)), {
    headers: { "Content-Type": "application/json" },
  });
