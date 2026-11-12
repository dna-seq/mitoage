/**
 * Base-path aware URLs. The site can be served from a sub-path (GitHub Pages:
 * https://just-dna.life/mitoage/), so every root-relative internal URL must go through
 * `href()`. Works in Astro pages, endpoints and Solid islands (Vite inlines BASE_URL).
 *
 *   href("/species/")       -> "/species/"          (base "/")
 *   href("/species/")       -> "/mitoage/species/"  (base "/mitoage")
 *   href("/")               -> "/mitoage/"
 *   href("https://x.org/")  -> unchanged; "#id" and "?q=" unchanged
 *
 * Idempotent: a path that already starts with the base is returned as is.
 */
const RAW_BASE: string = import.meta.env.BASE_URL ?? "/";

/** Base path with exactly one trailing slash, e.g. "/" or "/mitoage/". */
export const BASE: string = `/${RAW_BASE.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");

export const href = (path: string): string => {
  if (!path || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(path)) return path;
  if (BASE !== "/" && (path === BASE.slice(0, -1) || path.startsWith(BASE))) return path;
  return BASE + path.replace(/^\/+/, "");
};

/** Strip the base from a pathname, e.g. "/mitoage/species/" -> "/species/". */
export const stripBase = (pathname: string): string =>
  BASE !== "/" && pathname.startsWith(BASE) ? `/${pathname.slice(BASE.length)}` : pathname;
