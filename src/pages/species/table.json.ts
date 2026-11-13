/** /species/table.json: one compact row per species for the species list (see ~/lib/speciesTable). */
import type { APIRoute } from "astro";
import { getAllSpecies, getRegionStats } from "~/data";
import { type SpeciesTableFile, TABLE_FIELDS } from "~/lib/speciesTable";

const r = (v: number | null | undefined, d: number): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d;

export const GET: APIRoute = () => {
  const body: SpeciesTableFile = {
    fields: TABLE_FIELDS,
    rows: getAllSpecies().map((s) => {
      const whole = getRegionStats(s.id).find((x) => x.region === "total_mtDNA");
      const t = s.traits;
      return [
        s.slug, s.scientificName, s.commonName.trim(), s.taxonomy.class, s.taxonomy.order, s.taxonomy.family,
        s.maxLongevityYears, s.mtdnaSizeBp, r(s.gcPercent, 3), r(whole?.gcSkew, 4), r(whole?.atSkew, 4), s.nonCodingBp,
        t.adultWeightG, t.birthWeightG, t.femaleMaturityDays, t.maleMaturityDays, t.gestationDays,
        t.litterSize, t.littersPerYear, t.growthRatePerDay, t.metabolicRateW, t.bodyTemperatureK,
        s.refseq,
      ];
    }),
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
};
