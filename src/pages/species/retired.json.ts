/** /species/retired.json: the build's retired records, which a FASTA download names (see ~/lib/retired). */
import type { APIRoute } from "astro";
import { getAllSpecies } from "~/data";
import { type RetiredFile, retiredRecords } from "~/lib/retired";

export const GET: APIRoute = () => {
  const body: RetiredFile = { retired: retiredRecords(getAllSpecies()) };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
};
