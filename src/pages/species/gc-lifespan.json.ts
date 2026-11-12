/**
 * Shared dataset for "where this species sits" plots: whole-genome GC% against maximum
 * lifespan for every species, in the columnar ScatterPayload format. One file, cached by
 * the browser across species pages, instead of 900+ inline copies.
 */
import type { APIRoute } from "astro";
import { gcLifespanPoints } from "~/lib/scatter";
import { pointsToPayload } from "~/lib/scatterTypes";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(pointsToPayload(gcLifespanPoints())), {
    headers: { "Content-Type": "application/json" },
  });
