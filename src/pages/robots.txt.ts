/** robots.txt, generated so the sitemap URL follows SITE_URL and BASE_PATH. */
import type { APIRoute } from "astro";
import { absoluteUrl } from "~/lib/urls";
import { href } from "~/lib/url";

export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *\nAllow: /\nDisallow: ${href("/view/")}\n\nSitemap: ${absoluteUrl("/sitemap-index.xml", site)}\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
