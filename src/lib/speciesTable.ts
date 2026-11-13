/**
 * The species list (/species/ and /species/life-history/): column sets for the genome and
 * life-history views, and the compact /species/table.json both load. Safe for islands.
 */
import type { Column, Row } from "~/components/ui/DataTable";
import { classLabel } from "~/lib/classes";
import { href } from "~/lib/url";
import { speciesUrl } from "~/lib/urls";

export type SpeciesView = "genome" | "life";

/** Field order of each row in /species/table.json. */
export const TABLE_FIELDS = [
  "slug", "name", "common", "className", "order", "family",
  "lifespan", "size", "gc", "gcSkew", "atSkew", "nonCoding",
  "adultWeightG", "birthWeightG", "femaleMaturityDays", "maleMaturityDays", "gestationDays",
  "litterSize", "littersPerYear", "growthRatePerDay", "metabolicRateW", "bodyTemperatureK",
] as const;
export type TableField = (typeof TABLE_FIELDS)[number];

export interface SpeciesTableFile {
  fields: readonly TableField[];
  rows: (string | number | null)[][];
}

export const SPECIES_TABLE_URL = href("/species/table.json");

/** DataTable row from a table.json row. */
export function tableRow(fields: readonly string[], r: readonly (string | number | null)[]): Row {
  const o: Row = {};
  fields.forEach((f, i) => {
    o[f] = r[i] ?? null;
  });
  const slug = String(o.slug ?? "");
  o.href = speciesUrl(slug);
  o.cls = classLabel(String(o.className ?? ""));
  return o;
}

const NAME: Column = { key: "name", label: "Species", kind: "sci", hrefKey: "href", subKey: "common", primary: true, csvSub: "Common name" };

export const SPECIES_COLUMNS: Record<SpeciesView, Column[]> = {
  genome: [
    NAME,
    { key: "cls", label: "Class" },
    { key: "order", label: "Order", hideOnMobile: true },
    { key: "size", label: "mtDNA length", format: "bp" },
    { key: "gc", label: "GC", format: "pct2" },
    { key: "gcSkew", label: "GC skew", format: "signed3", title: "(G − C) / (G + C), whole genome, L strand" },
    { key: "atSkew", label: "AT skew", format: "signed3", title: "(A − T) / (A + T), whole genome, L strand", hideOnMobile: true },
    { key: "nonCoding", label: "Non-coding", format: "bp", hideOnMobile: true },
    { key: "lifespan", label: "Max lifespan", format: "lifespan" },
  ],
  life: [
    NAME,
    { key: "cls", label: "Class" },
    { key: "lifespan", label: "Max lifespan", format: "lifespan" },
    { key: "adultWeightG", label: "Adult mass", format: "mass" },
    { key: "birthWeightG", label: "Birth mass", format: "mass", hideOnMobile: true },
    { key: "femaleMaturityDays", label: "Female maturity", format: "days" },
    { key: "maleMaturityDays", label: "Male maturity", format: "days", hideOnMobile: true },
    { key: "gestationDays", label: "Gestation", format: "days", title: "Gestation or incubation" },
    { key: "litterSize", label: "Litter size", format: "dec1", title: "Litter or clutch size" },
    { key: "littersPerYear", label: "Litters / yr", format: "dec1", hideOnMobile: true },
    { key: "growthRatePerDay", label: "Growth rate", format: "dec3", title: "Postnatal growth rate per day", hideOnMobile: true },
    { key: "metabolicRateW", label: "Metabolic rate (W)", format: "dec3", title: "Basal metabolic rate in watts", hideOnMobile: true },
    { key: "bodyTemperatureK", label: "Body temp.", format: "celsius", hideOnMobile: true },
  ],
};

export const SPECIES_SEARCH_KEYS = ["name", "common", "order", "family", "cls", "className"];
