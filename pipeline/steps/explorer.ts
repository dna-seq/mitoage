/** Explorer payload (served as /data/explorer.json, built during the site build). Pure: no Bun APIs. */
import type { BuildInfo, FeatureDef, Species } from "../../src/data/schema";
import { roundSig } from "../lib/stats";
import { TRAIT_KEYS, traitValue } from "./correlations";

/** Columnar payload for the in-browser scatter explorer (built during the site build). */
export function buildExplorer(
  species: Species[],
  defs: FeatureDef[],
  values: Map<string, (number | null)[]>,
  buildInfo: BuildInfo,
): unknown {
  const classes = [...new Set(species.map((s) => s.taxonomy.class))].sort();
  const orders = [...new Set(species.map((s) => s.taxonomy.order))].sort();
  const families = [...new Set(species.map((s) => s.taxonomy.family))].sort();
  const keep = defs.filter((d) => !/^(codon|aa):/.test(d.key) || d.key.includes(":total_pc:"));
  const sig = (v: number | null) => (v === null ? null : Math.abs(v) >= 1000 ? Math.round(v) : roundSig(v, 4));
  return {
    build: buildInfo.build,
    generatedAt: buildInfo.generatedAt,
    n: species.length,
    classes,
    orders,
    families,
    species: {
      id: species.map((s) => s.id),
      slug: species.map((s) => s.slug),
      scientificName: species.map((s) => s.scientificName),
      commonName: species.map((s) => s.commonName),
      class: species.map((s) => classes.indexOf(s.taxonomy.class)),
      order: species.map((s) => orders.indexOf(s.taxonomy.order)),
      family: species.map((s) => families.indexOf(s.taxonomy.family)),
    },
    traits: Object.fromEntries(TRAIT_KEYS.map((t) => [t, species.map((s) => sig(traitValue(s, t)))])),
    features: keep.map((d) => ({ key: d.key, label: d.label, region: d.region, group: d.group })),
    values: Object.fromEntries(keep.map((d) => [d.key, (values.get(d.key) ?? []).map(sig)])),
  };
}
