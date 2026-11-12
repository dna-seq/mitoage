/**
 * Static search index for the SearchBox island: species (scientific + common names),
 * taxa above species rank, and genes/regions. Emitted at build time as /search-index.json.
 */
import type { APIRoute } from "astro";
import { getAllSpecies, getTaxa } from "~/data";
import { classLabel } from "~/lib/classes";
import { fmtInt } from "~/lib/format";
import { GENE_PAGE_REGIONS, REGION_INFO } from "~/lib/genes";
import type { SearchIndex, SearchItem } from "~/lib/searchTypes";
import { geneUrl, speciesUrl, taxonUrl } from "~/lib/urls";

const RANK_LABEL: Record<string, string> = {
  kingdom: "Kingdom",
  phylum: "Phylum",
  class: "Class",
  order: "Order",
  family: "Family",
  genus: "Genus",
};

export const GET: APIRoute = () => {
  const items: SearchItem[] = [];
  for (const s of getAllSpecies()) {
    items.push({
      k: "s",
      n: s.scientificName,
      a: s.commonName,
      m: `${s.taxonomy.order} · ${classLabel(s.taxonomy.class)}`,
      u: speciesUrl(s.slug),
    });
  }
  for (const t of getTaxa()) {
    if (t.rank === "species" || t.rank === "kingdom") continue;
    items.push({
      k: "t",
      n: t.name,
      a: t.rank === "class" ? classLabel(t.name) : "",
      m: `${RANK_LABEL[t.rank] ?? t.rank} · ${fmtInt(t.speciesCount)} ${t.speciesCount === 1 ? "species" : "species"}`,
      u: taxonUrl(t.rank, t.slug),
    });
  }
  for (const r of GENE_PAGE_REGIONS) {
    const info = REGION_INFO[r];
    items.push({ k: "g", n: r.replace("_", "-"), a: info.name, m: info.kind, u: geneUrl(r) });
  }
  const body: SearchIndex = { v: 1, items };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
};
