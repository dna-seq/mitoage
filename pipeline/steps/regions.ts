/**
 * Region base composition and codon usage: MitoAge CSV values (with the base-label fix)
 * cross-checked against, and gap-filled from, the RefSeq sequences and annotation.
 */
import {
  AGGREGATE_REGIONS,
  PROTEIN_GENES,
  type CodonUsage,
  type ProteinGene,
  type Region,
  type RegionStats,
} from "../../src/data/schema";
import { CODONS, aminoAcidCounts, countCodons } from "../lib/genetic-code";
import { type BaseCounts, countBases, gcPercent, round, skew } from "../lib/stats";
import type { RawComposition, RawData } from "../sources/mitoage";
import { type SpeciesGenome, coverage, extractFeature, maskedSequence } from "./genome";

export const REGIONS: Region[] = [...AGGREGATE_REGIONS, ...PROTEIN_GENES];

/**
 * The MitoAge CSV base columns are complement-labelled: the column "G" holds the number of
 * C on the RefSeq strand, "C" holds G, "A" holds T and "T" holds A (verified against the
 * sequences, see notes). This maps a CSV row to true RefSeq-strand counts.
 */
export function fixCsvLabels(r: RawComposition): BaseCounts {
  return { a: r.labelT, c: r.labelG, g: r.labelC, t: r.labelA, other: r.other };
}

/** Features that make up a region, used for recomputation from GenBank. */
function regionFeatures(g: SpeciesGenome, region: Region) {
  const f = g.features;
  switch (region) {
    case "total_mtDNA":
      return null;
    case "total_pc":
      return f.filter((x) => x.type === "CDS");
    case "total_rRNA":
      return f.filter((x) => x.type === "rRNA");
    case "total_tRNA":
      return f.filter((x) => x.type === "tRNA");
    case "D_Loop":
      return f.filter((x) => x.type === "D-loop");
    default: {
      // Single genes: the first copy when a gene is duplicated.
      const first = f.find((x) => x.name === region);
      return first ? [first] : [];
    }
  }
}

export function computeRegion(g: SpeciesGenome, region: Region): { counts: BaseCounts; length: number } | null {
  const seq = g.record.sequence;
  const feats = regionFeatures(g, region);
  if (feats === null) return { counts: countBases(seq), length: seq.length };
  if (feats.length === 0) return null;
  const s = maskedSequence(seq, coverage(feats, seq.length));
  return { counts: countBases(s), length: s.length };
}

/** Non-coding length: genome positions not covered by any CDS, rRNA or tRNA. */
export function computeNonCoding(g: SpeciesGenome): number {
  const len = g.record.sequence.length;
  const mask = coverage(
    g.features.filter((f) => f.type !== "D-loop"),
    len,
  );
  let covered = 0;
  for (const m of mask) covered += m;
  return len - covered;
}

const sameCounts = (x: BaseCounts, y: BaseCounts) => x.a === y.a && x.c === y.c && x.g === y.g && x.t === y.t;

export function makeStats(speciesId: number, region: Region, b: BaseCounts, source: "mitoage" | "genbank"): RegionStats {
  return {
    speciesId,
    region,
    lengthBp: b.a + b.c + b.g + b.t + b.other,
    a: b.a,
    c: b.c,
    g: b.g,
    t: b.t,
    other: b.other,
    gcPercent: round(gcPercent(b), 3),
    gcSkew: (() => {
      const v = skew(b.g, b.c);
      return v === null ? null : round(v, 5);
    })(),
    atSkew: (() => {
      const v = skew(b.a, b.t);
      return v === null ? null : round(v, 5);
    })(),
    source,
  };
}

export interface RegionReport {
  /** Per region: rows compared, exact matches, label-identity matches (should be 0). */
  agreement: Record<string, { compared: number; exact: number; asLabelled: number; lengthDiff: number }>;
  filledFromGenBank: Record<string, number>;
  duplicateRowsResolved: string[];
  csvOnly: Record<string, number>;
}

export function buildRegionStats(
  speciesIds: number[],
  raw: RawData,
  genomes: Map<number, SpeciesGenome>,
): { stats: RegionStats[]; report: RegionReport } {
  const stats: RegionStats[] = [];
  const report: RegionReport = { agreement: {}, filledFromGenBank: {}, duplicateRowsResolved: [], csvOnly: {} };
  for (const id of speciesIds) {
    const g = genomes.get(id);
    for (const region of REGIONS) {
      const rows = raw.composition.get(region)?.get(id) ?? [];
      const computed = g ? computeRegion(g, region) : null;
      if (rows.length > 0) {
        let chosen = rows[0]!;
        if (rows.length > 1) {
          // Several CSV rows for one region: keep the one matching the RefSeq annotation.
          const match = computed && rows.find((r) => sameCounts(fixCsvLabels(r), computed.counts));
          const closest = computed
            ? [...rows].sort((x, y) => Math.abs(x.lengthBp - computed.length) - Math.abs(y.lengthBp - computed.length))[0]!
            : rows[0]!;
          chosen = match ?? closest;
          report.duplicateRowsResolved.push(
            `${region} of HAGRID ${id}: ${rows.length} CSV rows (lengths ${rows.map((r) => r.lengthBp).join(", ")}), kept ${chosen.lengthBp} bp${match ? " (matches RefSeq annotation)" : " (closest length to RefSeq annotation)"}`,
          );
        }
        const fixed = fixCsvLabels(chosen);
        if (fixed.a + fixed.c + fixed.g + fixed.t + fixed.other !== chosen.lengthBp) {
          throw new Error(`CSV counts do not sum to length for ${region} HAGRID ${id}`);
        }
        stats.push(makeStats(id, region, fixed, "mitoage"));
        const a = (report.agreement[region] ??= { compared: 0, exact: 0, asLabelled: 0, lengthDiff: 0 });
        if (computed) {
          a.compared++;
          if (sameCounts(fixed, computed.counts)) a.exact++;
          const asIs: BaseCounts = { a: chosen.labelA, c: chosen.labelC, g: chosen.labelG, t: chosen.labelT, other: 0 };
          if (sameCounts(asIs, computed.counts)) a.asLabelled++;
          if (computed.length !== chosen.lengthBp) a.lengthDiff++;
        } else {
          report.csvOnly[region] = (report.csvOnly[region] ?? 0) + 1;
        }
      } else if (computed) {
        stats.push(makeStats(id, region, computed.counts, "genbank"));
        report.filledFromGenBank[region] = (report.filledFromGenBank[region] ?? 0) + 1;
      }
    }
  }
  return { stats, report };
}

export interface CodonReport {
  agreement: Record<string, { compared: number; exact: number }>;
  filledFromGenBank: Record<string, number>;
  totalPcEqualsGeneSum: { compared: number; equal: number };
}

const CODON_REGIONS: (ProteinGene | "total_pc")[] = [...PROTEIN_GENES, "total_pc"];

export function computeGeneCodons(g: SpeciesGenome, gene: ProteinGene): Record<string, number> | null {
  const f = g.features.find((x) => x.type === "CDS" && x.name === gene);
  if (!f) return null;
  return countCodons(extractFeature(g.record.sequence, f.segments), f.codonStart).counts;
}

const sumCounts = (list: Record<string, number>[]) => {
  const out: Record<string, number> = {};
  for (const c of CODONS) out[c] = list.reduce((s, x) => s + (x[c] ?? 0), 0);
  return out;
};
const equalCounts = (x: Record<string, number>, y: Record<string, number>) => CODONS.every((c) => (x[c] ?? 0) === (y[c] ?? 0));

export function buildCodonUsage(
  speciesIds: number[],
  raw: RawData,
  genomes: Map<number, SpeciesGenome>,
  tableOf: (id: number) => number,
): { usage: (CodonUsage & { source: "mitoage" | "genbank"; translTable: number })[]; report: CodonReport } {
  const usage: (CodonUsage & { source: "mitoage" | "genbank"; translTable: number })[] = [];
  const report: CodonReport = { agreement: {}, filledFromGenBank: {}, totalPcEqualsGeneSum: { compared: 0, equal: 0 } };
  for (const id of speciesIds) {
    const g = genomes.get(id);
    const table = tableOf(id);
    const geneCounts: Record<string, Record<string, number>> = {};
    for (const region of CODON_REGIONS) {
      const row = raw.codons.get(region)?.get(id);
      let counts: Record<string, number> | null = null;
      let source: "mitoage" | "genbank" = "mitoage";
      if (row) {
        counts = {};
        for (const c of CODONS) counts[c] = row.counts[c] ?? 0;
        if (g && region !== "total_pc") {
          const comp = computeGeneCodons(g, region);
          if (comp) {
            const a = (report.agreement[region] ??= { compared: 0, exact: 0 });
            a.compared++;
            if (equalCounts(comp, counts)) a.exact++;
          }
        }
      } else if (g) {
        if (region === "total_pc") {
          const parts = PROTEIN_GENES.map((p) => geneCounts[p]).filter((x): x is Record<string, number> => !!x);
          if (parts.length > 0) counts = sumCounts(parts);
        } else {
          counts = computeGeneCodons(g, region);
        }
        source = "genbank";
        if (counts) report.filledFromGenBank[region] = (report.filledFromGenBank[region] ?? 0) + 1;
      }
      if (!counts) continue;
      if (region !== "total_pc") geneCounts[region] = counts;
      else if (source === "mitoage") {
        const parts = PROTEIN_GENES.map((p) => geneCounts[p]).filter((x): x is Record<string, number> => !!x);
        report.totalPcEqualsGeneSum.compared++;
        if (equalCounts(sumCounts(parts), counts)) report.totalPcEqualsGeneSum.equal++;
      }
      usage.push({ speciesId: id, region, counts, aminoAcids: aminoAcidCounts(counts, table), source, translTable: table });
    }
  }
  return { usage, report };
}
