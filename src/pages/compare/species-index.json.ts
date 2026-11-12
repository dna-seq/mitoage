/**
 * Compact species list for the compare page's species picker and suggestions:
 * [slug, scientific name, common name, class index, order, max lifespan in years].
 */
import type { APIRoute } from "astro";
import { getAllSpecies } from "~/data";
import type { CompareIndex } from "~/lib/explore/compareTypes";

export const GET: APIRoute = () => {
  const species = getAllSpecies();
  const classes = [...new Set(species.map((s) => s.taxonomy.class))].sort();
  const body: CompareIndex = {
    classes,
    s: species.map((s) => [
      s.slug,
      s.scientificName,
      s.commonName,
      classes.indexOf(s.taxonomy.class),
      s.taxonomy.order,
      s.maxLongevityYears,
    ]),
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
};
