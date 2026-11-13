/** /compare/codons/{group}.json: codon and amino-acid frequency summaries in one group (see ~/lib/compare/wire). */
import type { APIRoute, GetStaticPaths } from "astro";
import { groupCodons, type StatsGroup, statsGroups } from "~/lib/compare/build";

export const getStaticPaths = (() =>
  statsGroups().map((group) => ({ params: { group: group.key }, props: { group } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(groupCodons((props as { group: StatsGroup }).group)), {
    headers: { "Content-Type": "application/json" },
  });
