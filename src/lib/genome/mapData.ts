/** Build-time props for the genome map. Reads the data API: do not import from islands. */
import { getGenomeFeatures, getRegionStats, getSpeciesBySlug } from "~/data";
import type { Species } from "~/data/schema";
import { featureLength, type MapFeature } from "./layout";

/** Reference genome used on the gene pages and the genes index. */
export const REFERENCE_SLUG = "homo-sapiens";

export interface MapData {
  features: MapFeature[];
  sizeBp: number;
  gc: Record<string, number>;
  genomeGc: number;
  name: string;
  common: string;
  refseq: string;
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

export const mapDataFor = (s: Species): MapData => {
  const { kept, omitted } = cleanFeatures(
    getGenomeFeatures(s.id).map((f) => ({ name: f.name, type: f.type, start: f.start, end: f.end, strand: f.strand })),
    s.mtdnaSizeBp,
  );
  const gc: Record<string, number> = {};
  for (const r of getRegionStats(s.id)) {
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
    omitted,
  };
};

export const referenceSpecies = (): Species => {
  const s = getSpeciesBySlug(REFERENCE_SLUG);
  if (!s) throw new Error(`Reference species ${REFERENCE_SLUG} is missing from the data`);
  return s;
};
