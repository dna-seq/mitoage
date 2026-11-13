/**
 * Precomputed correlations for one trait and scope, sorted by |Spearman rho|:
 * /compare/plot/correlations/{trait}/{scope}.json, e.g. /compare/plot/correlations/maxLongevityYears/class-mammalia.json.
 * Each file is one (trait, scope) slice of the pipeline's correlation table (at most 1,257 rows),
 * so the browser never downloads the whole table.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import type { TraitKey } from "~/data";
import { buildCorrFile, corrIndex } from "~/lib/explore/build";
import { scopeSlug } from "~/lib/explore/wire";

export const getStaticPaths = (() => {
  const ix = corrIndex();
  return ix.traits.flatMap((trait, ti) =>
    ix.scopes
      .filter((_, si) => (ix.rows[ti]?.[si] ?? 0) > 0)
      .map((scope) => ({ params: { trait, scope: scopeSlug(scope) }, props: { trait, scope } })),
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { trait, scope } = props as { trait: TraitKey; scope: string };
  return new Response(JSON.stringify(buildCorrFile(trait, scope)), {
    headers: { "Content-Type": "application/json" },
  });
};
