/**
 * Build-time helpers for the explorer endpoints and page. Reads the data API: do not import
 * from islands (use ./wire and ./variables there).
 */
import { getAllSpecies, getCorrelations, getFeatureDefs, getFeatureValues, type Correlation, type TraitKey } from "~/data";
import { type ChunkFile, type CorrFile, type CorrIndex, chunkName } from "./wire";
import { type ChunkKind, chunkOf, FEATURE_KEYS, getVariable, isExtendedVar, TRAIT_KEYS, type VarRegion } from "./variables";
import { isExtendedFeature } from "../../../pipeline/steps/extended";

/**
 * Fail the build if the island's feature catalogue drifts from the pipeline's feature list, or if
 * the payload and the chunks disagree on where a feature's values are. explorer.json leaves the
 * extended features out (`isExtendedFeature`, pipeline/steps/extended.ts) and the client looks for
 * them in the per-region chunks (`isExtendedVar`); a feature on one side only would plot as empty.
 */
export function assertCatalogMatchesData(): void {
  const ours = new Set(FEATURE_KEYS());
  const theirs = getFeatureDefs().map((d) => d.key);
  const missing = theirs.filter((k) => !ours.has(k));
  const extra = [...ours].filter((k) => !theirs.includes(k));
  if (missing.length || extra.length) {
    throw new Error(
      `Explorer feature catalogue out of sync with the data (${ours.size} offered vs ${theirs.length} expected); ` +
        `missing e.g. ${missing.slice(0, 5).join(", ")}; unexpected e.g. ${extra.slice(0, 5).join(", ")}`,
    );
  }
  const split = theirs.filter((k) => isExtendedFeature(k) !== isExtendedVar(getVariable(k)!));
  if (split.length) {
    throw new Error(`Explorer payload and chunks disagree on ${split.length} features, e.g. ${split.slice(0, 5).join(", ")}`);
  }
}

// ---------------------------------------------------------------- per-gene value chunks

export interface ChunkSpec {
  name: string;
  region: VarRegion;
  kind: ChunkKind;
}

/** One chunk per (region, kind) that some feature of the catalogue loads from, in catalogue order. */
export const chunkSpecs = (): ChunkSpec[] => {
  const seen = new Map<string, ChunkSpec>();
  for (const k of FEATURE_KEYS()) {
    const c = chunkOf(getVariable(k)!);
    if (!c) continue;
    const name = chunkName(c.region, c.kind);
    if (!seen.has(name)) seen.set(name, { name, region: c.region, kind: c.kind });
  }
  return [...seen.values()];
};

export function buildChunk(spec: ChunkSpec): ChunkFile {
  const ids = getAllSpecies().map((s) => s.id);
  const keys = FEATURE_KEYS().filter((k) => {
    const c = chunkOf(getVariable(k)!);
    return c !== null && c.region === spec.region && c.kind === spec.kind;
  });
  const values = keys.map((k) => {
    const byId = getFeatureValues(k);
    return ids.map((id) => {
      const v = byId[id];
      return v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000;
    });
  });
  return { region: spec.region, kind: spec.kind, ids, keys, values };
}

// ---------------------------------------------------------------- precomputed correlations

const SCOPE_ORDER = (s: string): number => (s === "all" ? 0 : s.startsWith("class:") ? 1 : 2);

let scopeCache: string[] | null = null;
/** Scopes with precomputed correlations: "all", then classes, then orders, alphabetical. */
export function corrScopes(): string[] {
  if (!scopeCache) {
    const set = new Set<string>();
    for (const t of TRAIT_KEYS) for (const r of getCorrelations({ trait: t })) set.add(r.scope);
    scopeCache = [...set].sort((a, b) => SCOPE_ORDER(a) - SCOPE_ORDER(b) || a.localeCompare(b));
  }
  return scopeCache;
}

export function corrIndex(): CorrIndex {
  const scopes = corrScopes();
  const traits = [...TRAIT_KEYS];
  return {
    traits,
    scopes,
    rows: traits.map((t) => scopes.map((s) => getCorrelations({ trait: t, scope: s }).length)),
    features: getFeatureDefs().length,
  };
}

const num = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : v;

export function buildCorrFile(trait: TraitKey, scope: string): CorrFile {
  const rows = [...getCorrelations({ trait, scope })].sort((a: Correlation, b: Correlation) => {
    const ra = Number.isFinite(a.spearmanRho) ? Math.abs(a.spearmanRho) : -1;
    const rb = Number.isFinite(b.spearmanRho) ? Math.abs(b.spearmanRho) : -1;
    return rb - ra;
  });
  const file: CorrFile = {
    trait,
    scope,
    f: rows.map((r) => r.featureKey),
    n: rows.map((r) => r.n),
    r: rows.map((r) => num(r.pearsonR)),
    rho: rows.map((r) => num(r.spearmanRho)),
    p: rows.map((r) => num(r.pValue)),
    q: rows.map((r) => num(r.qValue)),
    pic: rows.map((r) => num(r.picR)),
    picP: rows.map((r) => num(r.picPValue)),
  };
  if (rows.some((r) => r.partialN !== undefined)) {
    file.pr = rows.map((r) => num(r.partialR));
    file.prP = rows.map((r) => num(r.partialPValue));
    file.prN = rows.map((r) => num(r.partialN));
  }
  return file;
}
