/** /compare/taxonomy.json: every species with its class, order, family, genus and lifespan (see ~/lib/compare/wire). */
import type { APIRoute } from "astro";
import { taxonomyFile } from "~/lib/compare/build";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(taxonomyFile()), { headers: { "Content-Type": "application/json" } });
