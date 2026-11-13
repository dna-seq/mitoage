/**
 * /compare/values/{region}.csv: one region in every species (the old site's "export section").
 * Base columns are on the L strand as deposited in RefSeq.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import { getAllSpecies, type Region } from "~/data";
import { regionValues } from "~/lib/compare/build";
import { paramValue, regionSlug, STATS_REGIONS } from "~/lib/compare/params";
import { toCsv } from "~/lib/csv";

export const getStaticPaths = (() =>
  STATS_REGIONS.map((region) => ({ params: { region: regionSlug(region) }, props: { region } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const region = (props as { region: Region }).region;
  const species = getAllSpecies();
  const v = regionValues(region);
  const header = [
    "species", "common_name", "class", "order", "family", "refseq", "region", "length_bp",
    "A", "C", "G", "T", "gc_percent", "at_percent", "gc_skew", "at_skew", "max_lifespan_years",
  ];
  const rows = v.species.map((si, i) => {
    const s = species[si]!;
    const counts = { lengthBp: v.length[i]!, a: v.a[i]!, c: v.c[i]!, g: v.g[i]!, t: v.t[i]!, gcSkew: v.gcSkew[i] ?? null, atSkew: v.atSkew[i] ?? null };
    const gc = paramValue(counts, "gc");
    const at = paramValue(counts, "at");
    return [
      s.scientificName, s.commonName.trim(), s.taxonomy.class, s.taxonomy.order, s.taxonomy.family, s.refseq, region,
      counts.lengthBp, counts.a, counts.c, counts.g, counts.t,
      gc === null ? null : Math.round(gc * 1000) / 1000,
      at === null ? null : Math.round(at * 1000) / 1000,
      counts.gcSkew, counts.atSkew, s.maxLongevityYears,
    ];
  });
  return new Response(toCsv(header, rows), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
};
