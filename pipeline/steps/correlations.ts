/** Feature x trait correlations per scope, with BH q-values, partial correlations and PIC. */
import type { Correlation, CorrelationDataset, FeatureDef, Species, TraitKey } from "../../src/data/schema";
import {
  type CompiledTree,
  benjaminiHochberg,
  correlationPValue,
  partialCorrelation,
  pearson,
  contrastCorrelation,
  hashString,
  picContrasts,
  partialContrastCorrelation,
  signFlipPValue,
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
/** Sign flips behind pic_signflip_p (docs/PIC_CALIBRATION.md); its smallest possible value is 1 / (reps + 1). */
export const SIGN_FLIP_REPS = 9999;
/** Sequential stop (Besag & Clifford 1991): flipping ends once this many flips are at least as extreme. */
export const SIGN_FLIP_STOP_HITS = 100;

export function traitValue(s: Species, key: TraitKey): number | null {
  return key === "maxLongevityYears" ? s.maxLongevityYears : s.traits[key];
}

export const log10OrNull = (v: number | null): number | null => (v !== null && v > 0 ? Math.log10(v) : null);

/**
 * Whether a species belongs to a correlation dataset. Retired species never do. "default": the
 * lifespan is neither estimated nor of low or questionable quality, from any source; "anage_only":
 * the same, with the lifespan from AnAge. A species without lifespan metadata (a build 1 file) is
 * in "default" only.
 */
export function inDataset(s: Species, d: CorrelationDataset): boolean {
  if (s.provenance?.recordStatus === "retired") return false;
  const l = s.lifespan;
  if (!l) return d === "default";
  if (l.recordType === "estimated" || l.quality === "low" || l.quality === "questionable") return false;
  return d === "default" || l.source === "AnAge";
}

export const datasetMembers = (species: Species[], d: CorrelationDataset) => species.filter((s) => inDataset(s, d));

export interface Scope {
  key: string;
  members: number[]; // indices into species array
  /** Whether per-gene codon/amino-acid features are correlated in this scope. */
  perGeneCodons: boolean;
}

export function buildScopes(species: Species[], include: (s: Species) => boolean = () => true): Scope[] {
  const all = species.map((_, i) => i).filter((i) => include(species[i]!));
  const scopes: Scope[] = [{ key: "all", members: all, perGeneCodons: true }];
  for (const rank of ["class", "order"] as const) {
    const groups = new Map<string, number[]>();
    all.forEach((i) => {
      const s = species[i]!;
      const k = s.taxonomy[rank];
      // A species with no name at this rank belongs to no taxon, so it forms no scope: without this
      // the species whose order is unknown are grouped under one empty key and tested as an order.
      if (!k) return;
      groups.set(k, [...(groups.get(k) ?? []), i]);
    });
    for (const [name, members] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (members.length >= MIN_SCOPE_SPECIES) scopes.push({ key: `${rank}:${name}`, members, perGeneCodons: rank === "class" });
    }
  }
  return scopes;
}

/**
 * Features of a single protein gene. They are correlated in the "all" and class scopes only, as the
 * per-gene codon and amino-acid features always were: one gene of thirteen on one linked molecule is
 * not an independent test, and the per-order scopes would multiply them past any useful correction.
 * The extended fourfold, heavy-strand and hydropathy features follow the same rule; their aggregates
 * (total_pc, major12) and the whole-genome features (repeats, motifs, contact zones) do not.
 */
const isPerGeneCodon = (key: string) =>
  (/^(codon|aa):/.test(key) && !key.includes(":total_pc:")) ||
  (/^(ff|ffH|gravy):/.test(key) && !key.includes(":total_pc") && !key.includes(":major12"));

export function computeCorrelations(
  species: Species[],
  defs: FeatureDef[],
  values: Map<string, (number | null)[]>,
  tree: CompiledTree | null,
  dataset: CorrelationDataset = "default",
  log: (msg: string) => void = () => {},
): { rows: Correlation[]; scopes: Scope[] } {
  const scopes = buildScopes(species, (s) => inDataset(s, dataset));
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
          dataset,
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
          const { cx, cy } = picContrasts(tree, xa, ya);
          const pic = contrastCorrelation(cx, cy);
          if (pic && Number.isFinite(pic.r)) {
            row.picR = pic.r;
            row.picPValue = pic.p;
            if (trait === "maxLongevityYears") row.picSignFlipP = signFlipPValue(cx, cy, SIGN_FLIP_REPS, hashString(`${dataset}|${scope.key}|${trait}|${d.key}`), SIGN_FLIP_STOP_HITS);
          }
          if (trait === "maxLongevityYears") {
            // Ancestry and body mass together: the contrasts of the species that also have a mass, with
            // log10 mass partialled out. The same minimum of species as the partial correlation across species.
            row.picMassR = null;
            row.picMassPValue = null;
            if (pz.length >= MIN_PAIRS) {
              const za = new Float64Array(nSpecies).fill(NaN);
              for (const i of scope.members) {
                const z = logWeight[i];
                if (z !== null && z !== undefined) za[i] = z;
              }
              const m3 = picContrasts(tree, xa, ya, za);
              const pm = partialContrastCorrelation(m3.cx, m3.cy, m3.cz);
              if (pm && Number.isFinite(pm.r)) {
                row.picMassR = pm.r;
                row.picMassPValue = pm.p;
              }
            }
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
    log(`    ${dataset} ${scope.key}: ${rows.length} correlations so far`);
  }
  return { rows, scopes };
}
