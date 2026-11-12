/** Per-species download: /species/{slug}.csv, base composition of every region. */
import type { APIRoute, GetStaticPaths } from "astro";
import { getAllSpecies, getRegionStats, type Species } from "~/data";

export const getStaticPaths = (() =>
  getAllSpecies().map((species) => ({ params: { slug: species.slug }, props: { species } }))) satisfies GetStaticPaths;

const cell = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET: APIRoute = ({ props }) => {
  const s = (props as { species: Species }).species;
  const header = ["species", "refseq", "region", "length_bp", "A", "C", "G", "T", "other", "gc_percent", "gc_skew", "at_skew"];
  const lines = [header.join(",")];
  for (const r of getRegionStats(s.id)) {
    lines.push(
      [s.scientificName, s.refseq, r.region, r.lengthBp, r.a, r.c, r.g, r.t, r.other, r.gcPercent, r.gcSkew, r.atSkew]
        .map(cell)
        .join(","),
    );
  }
  return new Response(`${lines.join("\n")}\n`, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
};
