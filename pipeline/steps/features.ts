/** Feature definitions (plottable numeric mtDNA features) and their per-species values. */
import { PROTEIN_GENES, type CodonUsage, type FeatureDef, type Region, type RegionStats } from "../../src/data/schema";
import { AMINO_ACIDS, CODONS, geneticCode } from "../lib/genetic-code";
import { round } from "../lib/stats";
import { REGIONS } from "./regions";

export const REGION_LABELS: Record<Region, string> = {
  total_mtDNA: "whole mtDNA",
  total_pc: "all protein-coding genes",
  total_rRNA: "rRNA genes",
  total_tRNA: "tRNA genes",
  "rRNA-12S": "12S rRNA",
  "rRNA-16S": "16S rRNA",
  D_Loop: "D-loop",
  ND1: "ND1", ND2: "ND2", COX1: "COX1", COX2: "COX2", ATP8: "ATP8", ATP6: "ATP6", COX3: "COX3",
  ND3: "ND3", ND4L: "ND4L", ND4: "ND4", ND5: "ND5", ND6: "ND6", CYTB: "CYTB",
};

const AA_NAMES: Record<string, string> = {
  A: "Ala", C: "Cys", D: "Asp", E: "Glu", F: "Phe", G: "Gly", H: "His", I: "Ile", K: "Lys", L: "Leu",
  M: "Met", N: "Asn", P: "Pro", Q: "Gln", R: "Arg", S: "Ser", T: "Thr", V: "Val", W: "Trp", Y: "Tyr",
};

export function buildFeatureDefs(): FeatureDef[] {
  const defs: FeatureDef[] = [];
  for (const r of REGIONS) {
    const l = REGION_LABELS[r];
    defs.push({ key: `size:${r}`, label: `Length of ${l} (bp)`, region: r, group: "size" });
    defs.push({ key: `gc:${r}`, label: `GC% of ${l}`, region: r, group: "composition" });
    defs.push({ key: `gcSkew:${r}`, label: `GC skew of ${l}`, region: r, group: "skew" });
    defs.push({ key: `atSkew:${r}`, label: `AT skew of ${l}`, region: r, group: "skew" });
  }
  defs.push({ key: "noncoding:total_mtDNA", label: "Non-coding length of mtDNA (bp)", region: "total_mtDNA", group: "size" });
  for (const r of ["total_pc", ...PROTEIN_GENES] as const) {
    const l = REGION_LABELS[r];
    for (const c of CODONS) {
      defs.push({ key: `codon:${r}:${c}`, label: `${c} codon frequency in ${l} (% of codons)`, region: r, group: "codon" });
    }
    for (const aa of AMINO_ACIDS) {
      defs.push({
        key: `aa:${r}:${aa}`,
        label: `${AA_NAMES[aa]} (${aa}) frequency in ${l} (% of sense codons)`,
        region: r,
        group: "aminoAcid",
      });
    }
  }
  return defs;
}

/** Feature values: key -> array aligned with `speciesIds` (null when missing). */
export function buildFeatureValues(
  defs: FeatureDef[],
  speciesIds: number[],
  stats: RegionStats[],
  usage: (CodonUsage & { translTable: number })[],
  nonCoding: Map<number, number | null>,
): Map<string, (number | null)[]> {
  const idx = new Map(speciesIds.map((id, i) => [id, i]));
  const values = new Map<string, (number | null)[]>();
  for (const d of defs) values.set(d.key, new Array<number | null>(speciesIds.length).fill(null));
  const set = (key: string, id: number, v: number | null) => {
    const arr = values.get(key);
    const i = idx.get(id);
    if (arr && i !== undefined) arr[i] = v;
  };
  for (const s of stats) {
    set(`size:${s.region}`, s.speciesId, s.lengthBp);
    set(`gc:${s.region}`, s.speciesId, round(s.gcPercent, 3));
    set(`gcSkew:${s.region}`, s.speciesId, s.gcSkew === null ? null : round(s.gcSkew, 4));
    set(`atSkew:${s.region}`, s.speciesId, s.atSkew === null ? null : round(s.atSkew, 4));
  }
  for (const [id, v] of nonCoding) set("noncoding:total_mtDNA", id, v);
  for (const u of usage) {
    const total = CODONS.reduce((s, c) => s + (u.counts[c] ?? 0), 0);
    const code = geneticCode(u.translTable);
    const sense = CODONS.reduce((s, c) => s + (code[c] === "*" ? 0 : (u.counts[c] ?? 0)), 0);
    if (total === 0) continue;
    for (const c of CODONS) set(`codon:${u.region}:${c}`, u.speciesId, round((100 * (u.counts[c] ?? 0)) / total, 3));
    if (sense === 0) continue;
    for (const aa of AMINO_ACIDS) set(`aa:${u.region}:${aa}`, u.speciesId, round((100 * (u.aminoAcids[aa] ?? 0)) / sense, 3));
  }
  return values;
}
