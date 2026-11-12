/** Per-species download: /species/{slug}.json with every statistic the page shows. */
import type { APIRoute, GetStaticPaths } from "astro";
import { getAllSpecies, getCodonUsage, getGenomeFeatures, getRegionStats, type Species } from "~/data";

export const getStaticPaths = (() =>
  getAllSpecies().map((species) => ({ params: { slug: species.slug }, props: { species } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const s = (props as { species: Species }).species;
  const body = {
    species: s,
    regions: getRegionStats(s.id),
    codonUsage: getCodonUsage(s.id),
    genomeFeatures: getGenomeFeatures(s.id),
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
};
