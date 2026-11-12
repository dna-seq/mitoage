/** Build-time construction of scatter data from the data API. Do not import from islands. */
import { getAllSpecies } from "~/data";
import type { Species } from "~/data/schema";
import { classGroup } from "./classes";
import type { ScatterPoint } from "./scatterTypes";
import { speciesUrl } from "./urls";

/** Public path of the shared GC% vs lifespan dataset (emitted by src/pages/species/gc-lifespan.json.ts). */
export const GC_LIFESPAN_URL = "/species/gc-lifespan.json";

/** Species we try to label on overview plots, if present in the data. */
export const KEY_SPECIES_SLUGS = [
  "homo-sapiens",
  "balaena-mysticetus",
  "mus-musculus",
  "heterocephalus-glaber",
  "arctica-islandica",
] as const;

const shortName = (s: Species): string => {
  const c = s.commonName.trim();
  if (!c) return s.scientificName;
  return c.length > 18 ? (c.split(/\s+/).slice(-2).join(" ") || c) : c;
};

/** Whole-genome GC% (y) against maximum lifespan in years (x, plotted on a log axis). */
export const gcLifespanPoints = (): ScatterPoint[] =>
  getAllSpecies()
    .filter((s) => Number.isFinite(s.gcPercent) && s.maxLongevityYears > 0)
    .map((s) => {
      const p: ScatterPoint = {
        id: s.slug,
        x: s.maxLongevityYears,
        y: s.gcPercent,
        group: classGroup(s.taxonomy.class),
        label: s.scientificName,
        short: shortName(s),
        href: speciesUrl(s.slug),
      };
      if (s.commonName) p.sub = s.commonName;
      return p;
    });

export const keySpeciesPresent = (): string[] => {
  const slugs = new Set(getAllSpecies().map((s) => s.slug));
  return KEY_SPECIES_SLUGS.filter((s) => slugs.has(s));
};
