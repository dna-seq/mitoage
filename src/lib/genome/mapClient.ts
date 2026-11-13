/**
 * Genome-map props that islands can build too: the MapData shape, the feature clean-up and the
 * conversion from /species/{slug}.json. No data imports: safe for islands. The build-time
 * builder in ./mapData.ts uses the same functions, so a map drawn at build time and one loaded in
 * the browser agree.
 */
import type { SpeciesFile } from "~/lib/explore/compareTypes";
import { featureLength, type MapFeature } from "./layout";

export interface MapData {
  features: MapFeature[];
  sizeBp: number;
  gc: Record<string, number>;
  genomeGc: number;
  name: string;
  common: string;
  refseq: string;
  /** Species URL slug. */
  slug: string;
  /** Features left out because they span most of the record (annotation artefacts). */
  omitted: MapFeature[];
}

/**
 * Features to draw. A few records annotate the D-loop (or another region) over most of the
 * molecule; such a feature would cover the whole ring, so it is left out and reported.
 */
export const cleanFeatures = (features: readonly MapFeature[], sizeBp: number): { kept: MapFeature[]; omitted: MapFeature[] } => {
  const kept: MapFeature[] = [];
  const omitted: MapFeature[] = [];
  for (const f of features) {
    const bad =
      f.start < 1 || f.end < 1 || f.start > sizeBp || f.end > sizeBp || featureLength(f, sizeBp) > sizeBp * 0.5;
    (bad ? omitted : kept).push(f);
  }
  return { kept, omitted };
};

/** Map props from the parts of a species record. */
export function buildMapData(file: Pick<SpeciesFile, "species" | "regions" | "genomeFeatures">): MapData {
  const s = file.species;
  const { kept, omitted } = cleanFeatures(
    file.genomeFeatures.map((f) => ({ name: f.name, type: f.type, start: f.start, end: f.end, strand: f.strand })),
    s.mtdnaSizeBp,
  );
  const gc: Record<string, number> = {};
  for (const r of file.regions) {
    if (!r.region.startsWith("total_") && Number.isFinite(r.gcPercent)) gc[r.region] = Math.round(r.gcPercent * 100) / 100;
  }
  return {
    features: kept,
    sizeBp: s.mtdnaSizeBp,
    gc,
    genomeGc: s.gcPercent,
    name: s.scientificName,
    common: s.commonName.trim(),
    refseq: s.refseq,
    slug: s.slug,
    omitted,
  };
}
