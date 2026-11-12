/** Wire format of /search-index.json (built by src/pages/search-index.json.ts). Safe for islands. */

export type SearchKind = "s" | "t" | "g";

export interface SearchItem {
  /** s = species, t = taxon, g = gene/region */
  k: SearchKind;
  /** Primary name: scientific name, taxon name or gene symbol. */
  n: string;
  /** Alternative name searched too: common name, or the gene's full name. */
  a: string;
  /** Meta line shown under the name. */
  m: string;
  /** URL. */
  u: string;
}

export interface SearchIndex {
  v: 1;
  items: SearchItem[];
}

export const SEARCH_INDEX_URL = "/search-index.json";
