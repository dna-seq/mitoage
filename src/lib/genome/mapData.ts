/** Build-time props for the genome map. Reads the data API: do not import from islands (use ./mapClient). */
import { getGenomeFeatures, getRegionStats, getSpeciesBySlug } from "~/data";
import type { Species } from "~/data/schema";
import { buildMapData, type MapData } from "./mapClient";

export { cleanFeatures, type MapData } from "./mapClient";

/** Reference genome used on the gene pages and the genes index until the reader picks another. */
export const REFERENCE_SLUG = "homo-sapiens";

export const mapDataFor = (s: Species): MapData =>
  buildMapData({ species: s, regions: getRegionStats(s.id), genomeFeatures: getGenomeFeatures(s.id) });

export const referenceSpecies = (): Species => {
  const s = getSpeciesBySlug(REFERENCE_SLUG);
  if (!s) throw new Error(`Reference species ${REFERENCE_SLUG} is missing from the data`);
  return s;
};

/** Quick picks offered next to the species search of the genome map, when present in the build. */
export const QUICK_MAP_SPECIES: readonly { slug: string; label: string }[] = [
  { slug: "homo-sapiens", label: "Human" },
  { slug: "mus-musculus", label: "House mouse" },
  { slug: "heterocephalus-glaber", label: "Naked mole-rat" },
  { slug: "balaena-mysticetus", label: "Bowhead whale" },
  { slug: "gallus-gallus", label: "Chicken" },
  { slug: "danio-rerio", label: "Zebrafish" },
  { slug: "drosophila-melanogaster", label: "Fruit fly" },
].filter((q) => getSpeciesBySlug(q.slug) !== undefined);
