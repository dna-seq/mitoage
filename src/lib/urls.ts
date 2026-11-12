/**
 * URL helpers. Every internal link to a species, taxon or gene goes through these,
 * so the URL scheme lives in one place. All paths end with "/" (trailingSlash: "always").
 */
import type { Rank, Region } from "~/data/schema";

export const speciesUrl = (slug: string): string => `/species/${slug}/`;

export const taxonUrl = (rank: Rank, slug: string): string => `/taxa/${rank}/${slug}/`;

/** "ND1" -> "nd1", "rRNA-12S" -> "rrna-12s", "D_Loop" -> "d-loop", "total_mtDNA" -> "total-mtdna". */
export const geneSlug = (region: Region | string): string =>
  region.toLowerCase().replace(/_/g, "-");

export const geneUrl = (region: Region | string): string => `/genes/${geneSlug(region)}/`;

export const compareUrl = (slugs: readonly string[]): string =>
  `/compare/?species=${slugs.map(encodeURIComponent).join(",")}`;

export const exploreUrl = (params?: { x?: string; y?: string; highlight?: string }): string => {
  const q = new URLSearchParams();
  if (params?.x) q.set("x", params.x);
  if (params?.y) q.set("y", params.y);
  if (params?.highlight) q.set("highlight", params.highlight);
  const s = q.toString();
  return s ? `/explore/?${s}` : "/explore/";
};

/** AnAge record, e.g. https://genomics.senescence.info/species/entry.php?species=Homo_sapiens */
export const anageUrl = (scientificName: string): string =>
  `https://genomics.senescence.info/species/entry.php?species=${encodeURIComponent(
    scientificName.trim().replace(/\s+/g, "_"),
  )}`;

export const refseqUrl = (accession: string): string =>
  `https://www.ncbi.nlm.nih.gov/nuccore/${encodeURIComponent(accession)}`;

/** Direct FASTA download of a RefSeq record through NCBI E-utilities. */
export const refseqFastaUrl = (accession: string): string =>
  `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${encodeURIComponent(
    accession,
  )}&rettype=fasta&retmode=text`;

export const refseqGenbankUrl = (accession: string): string =>
  `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${encodeURIComponent(
    accession,
  )}&rettype=gbwithparts&retmode=text`;

/** Absolute URL on the production site. */
export const absoluteUrl = (path: string, site: URL | string | undefined): string =>
  new URL(path, site ?? "https://www.mitoage.info").toString();
