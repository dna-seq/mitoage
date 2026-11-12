/** Web app manifest, generated so icon and start URLs follow BASE_PATH. */
import type { APIRoute } from "astro";
import { href } from "~/lib/url";

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: "MitoAge",
      short_name: "MitoAge",
      description: "Mitochondrial DNA and animal longevity",
      start_url: href("/"),
      scope: href("/"),
      display: "standalone",
      background_color: "#f4fae6",
      theme_color: "#0e4a22",
      icons: [
        { src: href("/favicon.svg"), sizes: "any", type: "image/svg+xml" },
        { src: href("/apple-touch-icon.png"), sizes: "180x180", type: "image/png" },
        { src: href("/icon-512.png"), sizes: "512x512", type: "image/png" },
      ],
    }),
    { headers: { "Content-Type": "application/manifest+json" } },
  );
