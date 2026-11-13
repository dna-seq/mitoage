/**
 * Browser-side loading for the comparative tables: each file is fetched once per page and cached.
 * Also small helpers to mirror table state in the query string. Islands only.
 */
import type { Region } from "~/data/schema";
import { groupCodonsDataUrl, groupStatsDataUrl, regionValuesDataUrl, TAXONOMY_DATA_URL } from "./params";
import type { GroupCodonsFile, GroupStatsFile, RegionValuesFile, TaxonomyFile } from "./wire";

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return (await r.json()) as T;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export const loadGroupStats = (key: string) => getJson<GroupStatsFile>(groupStatsDataUrl(key));
export const loadGroupCodons = (key: string) => getJson<GroupCodonsFile>(groupCodonsDataUrl(key));
export const loadTaxonomy = () => getJson<TaxonomyFile>(TAXONOMY_DATA_URL);
export const loadRegionValues = (region: Region) => getJson<RegionValuesFile>(regionValuesDataUrl(region));

/** Read one query parameter (null on the server or when absent). */
export const queryParam = (name: string): string | null =>
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name);

/** Set (or, for null and defaults, remove) query parameters without adding a history entry. */
export function setQuery(values: Record<string, string | null>): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  window.history.replaceState(window.history.state, "", url);
}
