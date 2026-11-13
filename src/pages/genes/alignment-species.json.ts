/**
 * The species beside the rows of the alignment viewer on /genes/{gene}/: slug, common name, class,
 * order and maximum lifespan, in the order of the site's tree (the taxonomy tree, leaves left to
 * right). One file for all genes, fetched when a viewer scrolls into view.
 */
import type { APIRoute } from "astro";
import { getSpeciesById, getTaxonomyTree } from "~/data";
import type { TaxonNode } from "~/data/schema";
import type { AlignmentSpeciesPayload } from "~/lib/alignment";

export const GET: APIRoute = () => {
  const classes: string[] = [];
  const orders: string[] = [];
  const index = (list: string[], v: string): number => {
    const i = list.indexOf(v);
    return i >= 0 ? i : list.push(v) - 1;
  };
  const rows: AlignmentSpeciesPayload["rows"] = [];
  const walk = (n: TaxonNode) => {
    if (n.speciesId !== undefined) {
      const s = getSpeciesById(n.speciesId);
      if (s) {
        rows.push([s.slug, s.commonName, index(classes, s.taxonomy.class), index(orders, s.taxonomy.order), s.maxLongevityYears]);
      }
    }
    n.children.forEach(walk);
  };
  walk(getTaxonomyTree());
  const payload: AlignmentSpeciesPayload = { classes, orders, rows };
  return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
};
