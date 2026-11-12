/**
 * JSON-LD builders. Pass the result to BaseLayout's `jsonLd` prop.
 * Build-time only (some helpers read the data API).
 */
import type { BuildInfo, Species } from "~/data/schema";
import { CITATION, CITATION_AUTHORS, CITATION_TEXT, SITE_DESCRIPTION, SITE_NAME } from "./site";
import { absoluteUrl, anageUrl, refseqUrl, speciesUrl } from "./urls";

export type JsonLd = Record<string, unknown>;

export const DATASET_PATH = "/data/";
export const datasetId = (site: URL | undefined): string => `${absoluteUrl(DATASET_PATH, site)}#dataset`;

export const websiteLd = (site: URL | undefined): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${absoluteUrl("/", site)}#website`,
  name: SITE_NAME,
  url: absoluteUrl("/", site),
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${absoluteUrl("/species/", site)}?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
});

const scholarlyArticle = (): JsonLd => ({
  "@type": "ScholarlyArticle",
  name: CITATION.title,
  headline: CITATION.title,
  author: CITATION_AUTHORS.map((name) => ({ "@type": "Person", name })),
  datePublished: String(CITATION.year),
  isPartOf: { "@type": "Periodical", name: "Nucleic Acids Research" },
  sameAs: [`https://doi.org/${CITATION.doi}`, `https://pubmed.ncbi.nlm.nih.gov/${CITATION.pmid}/`],
});

export interface DistributionFile {
  name: string;
  path: string;
  format: string;
  description?: string;
}

export const datasetLd = (
  site: URL | undefined,
  info: BuildInfo,
  files: readonly DistributionFile[],
): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "Dataset",
  "@id": datasetId(site),
  name: `${SITE_NAME}: mitochondrial DNA and animal longevity`,
  description: `${SITE_DESCRIPTION} Covers ${info.speciesCount} species with complete RefSeq mitochondrial genomes and maximum lifespan from AnAge.`,
  url: absoluteUrl(DATASET_PATH, site),
  version: info.build,
  dateModified: info.generatedAt,
  keywords: [
    "mitochondrial DNA",
    "mtDNA",
    "longevity",
    "lifespan",
    "aging",
    "base composition",
    "codon usage",
    "comparative genomics",
  ],
  creator: CITATION_AUTHORS.map((name) => ({ "@type": "Person", name })),
  citation: [CITATION_TEXT, scholarlyArticle()],
  isBasedOn: info.sources.map((s) => ({
    "@type": "Dataset",
    name: s.name,
    version: s.version,
    url: s.url,
    license: s.license,
  })),
  isAccessibleForFree: true,
  distribution: files.map((f) => {
    const d: JsonLd = {
      "@type": "DataDownload",
      name: f.name,
      encodingFormat: f.format,
      contentUrl: absoluteUrl(f.path, site),
    };
    if (f.description) d["description"] = f.description;
    return d;
  }),
});

export const taxonLd = (site: URL | undefined, s: Species, genusUrl?: string): JsonLd => {
  const parent: JsonLd = {
    "@type": "Taxon",
    name: s.taxonomy.genus,
    taxonRank: "genus",
  };
  if (genusUrl) parent["url"] = absoluteUrl(genusUrl, site);
  const ld: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Taxon",
    "@id": `${absoluteUrl(speciesUrl(s.slug), site)}#taxon`,
    name: s.scientificName,
    taxonRank: "species",
    url: absoluteUrl(speciesUrl(s.slug), site),
    parentTaxon: parent,
    sameAs: [anageUrl(s.scientificName), refseqUrl(s.refseq)],
    subjectOf: {
      "@type": "Dataset",
      "@id": datasetId(site),
      name: SITE_NAME,
      url: absoluteUrl(DATASET_PATH, site),
    },
  };
  if (s.commonName) ld["alternateName"] = s.commonName;
  return ld;
};

export const breadcrumbLd = (site: URL | undefined, items: { name: string; path: string }[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: absoluteUrl(it.path, site),
  })),
});
