/**
 * Compact taxonomy for the radial tree and the clade islands on taxon pages: every node
 * (name, slug, rank, parent, age, class) in columnar pre-order, plus lifespan, GC% and mtDNA
 * size per species. See src/lib/tree/types.ts for the format.
 */
import type { APIRoute } from "astro";
import { buildTreePayload } from "~/lib/tree/build";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildTreePayload()), {
    headers: { "Content-Type": "application/json" },
  });
