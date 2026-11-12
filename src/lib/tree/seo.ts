/** JSON-LD for taxon pages (schema.org Taxon). Build-time only. */
import type { Species, TaxonNode } from "~/data/schema";
import { datasetId, DATASET_PATH, type JsonLd } from "~/lib/seo";
import { SITE_NAME } from "~/lib/site";
import { absoluteUrl, speciesUrl, taxonUrl } from "~/lib/urls";

const ref = (site: URL | undefined, n: TaxonNode, species?: Species): JsonLd => ({
  "@type": "Taxon",
  name: n.name,
  taxonRank: n.rank,
  url: absoluteUrl(n.rank === "species" && species ? speciesUrl(species.slug) : taxonUrl(n.rank, n.slug), site),
});

export const cladeLd = (
  site: URL | undefined,
  node: TaxonNode,
  opts: { parent?: TaxonNode | undefined; alternateName?: string | undefined; speciesOf?: (n: TaxonNode) => Species | undefined },
): JsonLd => {
  const url = absoluteUrl(taxonUrl(node.rank, node.slug), site);
  const ld: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Taxon",
    "@id": `${url}#taxon`,
    name: node.name,
    taxonRank: node.rank,
    url,
    childTaxon: node.children.slice(0, 60).map((c) => ref(site, c, opts.speciesOf?.(c))),
    subjectOf: {
      "@type": "Dataset",
      "@id": datasetId(site),
      name: SITE_NAME,
      url: absoluteUrl(DATASET_PATH, site),
    },
  };
  if (opts.alternateName) ld["alternateName"] = opts.alternateName;
  if (opts.parent) ld["parentTaxon"] = ref(site, opts.parent);
  return ld;
};
