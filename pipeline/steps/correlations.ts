/** Feature x trait correlations per scope, with BH q-values, partial correlations and PIC. */
import type { Correlation, FeatureDef, Species, TraitKey } from "../../src/data/schema";
import {
  type CompiledTree,
  benjaminiHochberg,
  correlationPValue,
  partialCorrelation,
  pearson,
  picFast,
  spearman,
} from "../lib/stats";

export const TRAIT_KEYS: TraitKey[] = [
  "maxLongevityYears",
  "adultWeightG",
  "birthWeightG",
  "metabolicRateW",
  "bodyTemperatureK",
  "femaleMaturityDays",
  "maleMaturityDays",
  "gestationDays",
  "litterSize",
  "littersPerYear",
  "growthRatePerDay",
];

export const MIN_SCOPE_SPECIES = 20;
export const MIN_PAIRS = 10;

export function traitValue(s: Species, key: TraitKey): number | null {
  return key === "maxLongevityYears" ? s.maxLongevityYears : s.traits[key];
}

export const log10OrNull = (v: number | null): number | null => (v !== null && v > 0 ? Math.log10(v) : null);

export interface Scope {
  key: string;
  members: number[]; // indices into species array
  /** Whether per-gene codon/amino-acid features are correlated in this scope. */
  perGeneCodons: boolean;
}

export function buildScopes(species: Species[]): Scope[] {
  const scopes: Scope[] = [{ key: "all", members: species.map((_, i) => i), perGeneCodons: true }];
  for (const rank of ["class", "order"] as const) {
    const groups = new Map<string, number[]>();
    species.forEach((s, i) => {
      const k = s.taxonomy[rank];
      groups.set(k, [...(groups.get(k) ?? []), i]);
    });
    for (const [name, members] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (members.length >= MIN_SCOPE_SPECIES) scopes.push({ key: `${rank}:${name}`, members, perGeneCodons: rank === "class" });
    }
  }
  return scopes;
}

const isPerGeneCodon = (key: string) => /^(codon|aa):/.test(key) && !key.includes(":total_pc:");

export function computeCorrelations(
  species: Species[],
  defs: FeatureDef[],
  values: Map<string, (number | null)[]>,
  tree: CompiledTree | null,
): { rows: Correlation[]; scopes: Scope[] } {
  const scopes = buildScopes(species);
  const logTraits = new Map<TraitKey, (number | null)[]>();
  for (const t of TRAIT_KEYS) logTraits.set(t, species.map((s) => log10OrNull(traitValue(s, t))));
  const logWeight = logTraits.get("adultWeightG")!;
  const rows: Correlation[] = [];
  const nSpecies = species.length;

  for (const scope of scopes) {
    const featureList = defs.filter((d) => scope.perGeneCodons || !isPerGeneCodon(d.key));
    for (const trait of TRAIT_KEYS) {
      const ty = logTraits.get(trait)!;
      const block: Correlation[] = [];
      for (const d of featureList) {
        const fx = values.get(d.key)!;
        const xs: number[] = [];
        const ys: number[] = [];
        const px: number[] = [];
        const py: number[] = [];
        const pz: number[] = [];
        for (const i of scope.members) {
          const x = fx[i];
          const y = ty[i];
          if (x === null || x === undefined || y === null || y === undefined) continue;
          xs.push(x);
          ys.push(y);
          const z = logWeight[i];
          if (trait === "maxLongevityYears" && z !== null && z !== undefined) {
            px.push(x);
            py.push(y);
            pz.push(z);
          }
        }
        const n = xs.length;
        if (n < MIN_PAIRS) continue;
        const r = pearson(xs, ys);
        if (!Number.isFinite(r)) continue; // constant feature in this scope
        const rho = spearman(xs, ys);
        const row: Correlation = {
          featureKey: d.key,
          trait,
          scope: scope.key,
          n,
          pearsonR: r,
          spearmanRho: Number.isFinite(rho) ? rho : 0,
          pValue: correlationPValue(r, n),
          qValue: NaN,
          picR: null,
          picPValue: null,
        };
        if (trait === "maxLongevityYears") {
          const pr = pz.length >= MIN_PAIRS ? partialCorrelation(px, py, pz) : NaN;
          row.partialR = Number.isFinite(pr) ? pr : null;
          row.partialPValue = Number.isFinite(pr) ? correlationPValue(pr, pz.length, 1) : null;
          row.partialN = pz.length;
        }
        if (tree) {
          const xa = new Float64Array(nSpecies).fill(NaN);
          const ya = new Float64Array(nSpecies).fill(NaN);
          for (const i of scope.members) {
            const x = fx[i];
            const y = ty[i];
            if (x === null || x === undefined || y === null || y === undefined) continue;
            xa[i] = x;
            ya[i] = y;
          }
          const pic = picFast(tree, xa, ya);
          if (pic && Number.isFinite(pic.r)) {
            row.picR = pic.r;
            row.picPValue = pic.p;
          }
        }
        block.push(row);
      }
      const q = benjaminiHochberg(block.map((r) => r.pValue));
      block.forEach((r, i) => {
        r.qValue = q[i]!;
      });
      rows.push(...block);
    }
    console.log(`    ${scope.key}: ${rows.length} correlations so far`);
  }
  return { rows, scopes };
}
