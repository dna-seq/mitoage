/** Wire formats used by the compare page. Safe for islands. */
import type { CodonUsage, GenomeFeature, RegionStats, Species } from "~/data/schema";
import { href } from "~/lib/url";

/** /compare/species-index.json: rows of [slug, scientific name, common name, class index, order, lifespan]. */
export interface CompareIndex {
  classes: string[];
  s: [string, string, string, number, string, number][];
}

export const COMPARE_INDEX_URL = href("/compare/species-index.json");

/** /species/{slug}.json (src/pages/species/[slug].json.ts). */
export interface SpeciesFile {
  species: Species;
  regions: RegionStats[];
  codonUsage: CodonUsage[];
  genomeFeatures: GenomeFeature[];
}

export const speciesJsonUrl = (slug: string): string => href(`/species/${encodeURIComponent(slug)}.json`);

export const MAX_COMPARE = 6;

/** A ready-made comparison suggested on the empty compare page. */
export interface Suggestion {
  title: string;
  why: string;
  species: { slug: string; name: string; common: string; lifespan: string; color: string }[];
  href: string;
}
