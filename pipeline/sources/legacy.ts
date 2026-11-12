/**
 * Legacy MitoAge site (www.mitoage.info, release of July 2015). Its paginated
 * total_mtDNA export (24 pages) lists every species with a link /view/{id}/species/,
 * which recovers the old numeric ids without crawling the individual species pages.
 */
import { cachedText, rateLimiter } from "../lib/cache";

const BASE = "https://www.mitoage.info/export-section/total_mtDNA/for-all-species/";

export interface LegacyIndex {
  /** Scientific name -> old site species id. */
  ids: Map<string, number>;
  pages: number;
}

export async function loadLegacyIds(): Promise<LegacyIndex | null> {
  const ids = new Map<string, number>();
  const limit = rateLimiter(2);
  try {
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const html = await cachedText(
        `legacy/total_mtDNA_page${String(page).padStart(2, "0")}.html`,
        `${BASE}?page=${page}`,
        {},
        limit,
      );
      for (const m of html.matchAll(/href="\?page=(\d+)"/g)) pages = Math.max(pages, Number(m[1]));
      for (const m of html.matchAll(/<a href="\/view\/(\d+)\/species\/">([^<]+)<\/a>/g)) {
        ids.set(m[2]!.trim(), Number(m[1]));
      }
    }
    return { ids, pages };
  } catch (e) {
    console.warn(`  legacy site unavailable: ${(e as Error).message}`);
    return null;
  }
}
