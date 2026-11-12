import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";
import sitemap from "@astrojs/sitemap";

const SITE = "https://www.mitoage.info";

export default defineConfig({
  site: SITE,
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
