import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";
import sitemap from "@astrojs/sitemap";

/**
 * Deploy target from the environment:
 *   default (own domain):  SITE_URL=https://www.mitoage.info  BASE_PATH=/
 *   GitHub Pages:          SITE_URL=https://dna-seq.github.io BASE_PATH=/mitoage
 * Internal links go through href() in src/lib/url.ts, which reads the base at build time.
 */
const SITE_URL = process.env["SITE_URL"] || "https://www.mitoage.info";
const BASE_PATH = process.env["BASE_PATH"] || "/";

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  output: "static",
  trailingSlash: "always",
  integrations: [
    solid(),
    sitemap({
      // Legacy redirect stubs and the 404 page do not belong in the sitemap.
      filter: (page) => !page.includes("/view/") && !page.endsWith("/404/"),
    }),
  ],
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  build: { inlineStylesheets: "auto" },
});
