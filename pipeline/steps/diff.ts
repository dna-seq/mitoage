/**
 * Differences between build 1 (the 2015 CSV values, base labels fixed) and the rows emitted in
 * build 2 for one species, each classified by what explains it. The evidence used is upstream data
 * only: the RefSeq record the build 2 row was computed from (same accession.version as build 1),
 * the source INSDC record named in its COMMENT (to recognise a re-annotation after 2015) and the
 * record's gene features. Classes:
 *
 * - rule_full_span (correction, rule): build 1 counted the full start..end span of a join() feature.
 * - upstream_reannotation_same_version (value_update): build 1 equals the source INSDC record.
 * - upstream_reannotation_same_version_probable (value_update): build 1 equals the gene feature span.
 * - coordinates_differ_origin_unresolved (correction): build 1 equals a window <= 60 bp away.
 * - build1_disagrees_with_cited_record (correction): none of the above.
 * - duplicate_csv_row (correction, rule), gap_fill_from_refseq (correction, rule).
 * - derived_from_<classes> for aggregates (total_pc, total_rRNA) and total_pc codon rows.
 * - upstream_version_change / refseq_successor (value_update) when the accession changed.
 */
import { PROTEIN_GENES, type CodonUsage, type GenomeFeature, type Region, type RegionStats } from "../../src/data/schema";
import { CODONS } from "../lib/genetic-code";
import { countBases } from "../lib/stats";
import type { RawComposition } from "../sources/mitoage";
import type { SpeciesGenome } from "./genome";
import { computeGeneCodons, computeRegion, fixCsvLabels, makeStats } from "./regions";

export interface RowChange {
  table: "region_stats" | "codon_usage" | "genome_features" | "species";
  rowKey: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: "value_update" | "correction" | "renamed" | "retired" | "added";
  diffClass: string;
  reason: string;
  scope: "row" | "rule";
}

export interface Classification {
  changeType: RowChange["changeType"];
  diffClass: string;
  reason: string;
  scope: "row" | "rule";
}

export interface AccessionChange {
  from: string;
  to: string;
  kind: "upstream_version_change" | "refseq_successor";
}

export interface GenomeDiffInput {
  id: number;
  /** Build 1 CSV rows of this species by region (several rows possible). */
  csvComposition: Map<Region, RawComposition[]>;
  /** Build 1 CSV codon counts by region (genes and total_pc). */
  csvCodons: Map<string, Record<string, number>>;
  emittedStats: RegionStats[];
  emittedCodons: CodonUsage[];
  /** Genome whose annotation explains the emitted rows (for retired species: the cited record). */
  evidence: SpeciesGenome;
  /** GenBank text of `evidence`, for its gene features. */
  evidenceText: string;
  /** Source INSDC record of a same-version RefSeq record, when cached. */
  primary: { accession: string; genome: SpeciesGenome } | null;
  accessionChange: AccessionChange | null;
  baselineFeatures: GenomeFeature[];
  emittedFeatures: GenomeFeature[];
}

export interface GenomeDiff {
  changes: RowChange[];
  /** Classification of differing non-duplicate aggregate rows (for non-coding length). */
  aggregates: { region: Region; c: Classification }[];
  /** Row keys (table:rowKey) present in build 1 but not emitted. */
  removed: string[];
}

const RF = ["length_bp", "a", "c", "g", "t", "other", "gc_percent"] as const;
type RF = (typeof RF)[number];
const SINGLE: Region[] = [...PROTEIN_GENES, "rRNA-12S", "rRNA-16S", "D_Loop"];
const AGG_MEMBERS: Partial<Record<Region, Region[]>> = {
  total_pc: [...PROTEIN_GENES],
  total_rRNA: ["rRNA-12S", "rRNA-16S"],
  total_tRNA: [],
};
const GENE_CLS_ORDER = [
  "gap_fill_from_refseq",
  "upstream_reannotation_same_version",
  "upstream_reannotation_same_version_probable",
  "rule_full_span",
  "coordinates_differ_origin_unresolved",
  "build1_disagrees_with_cited_record",
];
const CORRECTION_CLASSES = new Set(["gap_fill_from_refseq", "rule_full_span", "coordinates_differ_origin_unresolved", "build1_disagrees_with_cited_record"]);

export const REASONS = {
  duplicate: "Build-1 CSV has two rows for this region; this row does not match the cited RefSeq annotation and is dropped (the sibling row matches)",
  fullSpan:
    "Build 1 counted the full start..end span of a segmented (join) feature, including the untranslated frameshift nucleotide(s); build 2 counts only annotated segments",
  probable:
    "Build-1 value equals the span of the RefSeq gene feature; the CDS/rRNA coordinates were changed (trimmed/extended) after build 1 while the gene feature kept the old span",
  disagrees: "Build-1 value is not reproducible from the cited RefSeq sequence and annotation (no contiguous window with these counts near the feature)",
  gapFill:
    "Region missing from the build-1 CSV export but annotated in the cited RefSeq record; computed from the sequence (D-loop may come from misc_feature control region)",
};

type Vals = Record<RF, number>;
const valsOfStats = (s: RegionStats): Vals => ({ length_bp: s.lengthBp, a: s.a, c: s.c, g: s.g, t: s.t, other: s.other, gc_percent: s.gcPercent });
const valsOfCsv = (id: number, region: Region, r: RawComposition): Vals => valsOfStats(makeStats(id, region, fixCsvLabels(r), "mitoage"));
const sameAcgt = (x: { a: number; c: number; g: number; t: number }, y: { a: number; c: number; g: number; t: number }) =>
  x.a === y.a && x.c === y.c && x.g === y.g && x.t === y.t;

/** Gene feature spans (min..max of the location) from a GenBank text. */
export function geneSpans(text: string): { start: number; end: number }[] {
  const feats = text.split("\nFEATURES", 2)[1]?.split("\nORIGIN", 1)[0] ?? "";
  const out: { start: number; end: number }[] = [];
  for (const m of feats.matchAll(/^ {5}gene\s+(\S+)/gm)) {
    const nums = [...m[1]!.matchAll(/\d+/g)].map((x) => Number(x[0]));
    if (nums.length >= 2) out.push({ start: Math.min(...nums), end: Math.max(...nums) });
  }
  return out;
}

/** 1-based start positions of circular windows of length L with exactly these base counts. */
export function windowStarts(seq: string, L: number, target: { a: number; c: number; g: number; t: number }): number[] {
  const n = seq.length;
  if (L <= 0 || L > n) return [];
  const s = seq + seq.slice(0, L);
  const pre = { A: new Int32Array(s.length + 1), C: new Int32Array(s.length + 1), G: new Int32Array(s.length + 1), T: new Int32Array(s.length + 1) };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    for (const b of ["A", "C", "G", "T"] as const) pre[b][i + 1] = pre[b][i]! + (ch === b ? 1 : 0);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (
      pre.A[i + L]! - pre.A[i]! === target.a &&
      pre.C[i + L]! - pre.C[i]! === target.c &&
      pre.G[i + L]! - pre.G[i]! === target.g &&
      pre.T[i + L]! - pre.T[i]! === target.t
    ) out.push(i + 1);
  }
  return out;
}

function classifyRegion(inp: GenomeDiffInput, region: Region, b1: Vals): Classification {
  const g = inp.evidence;
  const seq = g.record.sequence;
  const target = { a: b1.a, c: b1.c, g: b1.g, t: b1.t };
  const f = SINGLE.includes(region)
    ? g.features.find((x) => (region === "D_Loop" ? x.type === "D-loop" : x.name === region))
    : undefined;
  if (f && f.start <= f.end && sameAcgt(countBases(seq.slice(f.start - 1, f.end)), target)) {
    return { changeType: "correction", diffClass: "rule_full_span", reason: REASONS.fullSpan, scope: "rule" };
  }
  if (inp.primary) {
    const p = computeRegion(inp.primary.genome, region);
    if (p && sameAcgt(p.counts, target)) {
      return {
        changeType: "value_update",
        diffClass: "upstream_reannotation_same_version",
        reason: `Build-1 value equals the source INSDC record ${inp.primary.accession}; the RefSeq record (same accession.version) was re-annotated after build 1`,
        scope: "row",
      };
    }
  }
  if (f) {
    if (f.start <= f.end) {
      for (const gs of geneSpans(inp.evidenceText)) {
        const ov = Math.min(gs.end, f.end) - Math.max(gs.start, f.start);
        if (ov > 0 && !(gs.start === f.start && gs.end === f.end) && sameAcgt(countBases(seq.slice(gs.start - 1, gs.end)), target)) {
          return { changeType: "value_update", diffClass: "upstream_reannotation_same_version_probable", reason: REASONS.probable, scope: "row" };
        }
      }
    }
    const L = b1.length_bp - b1.other;
    if (b1.other === 0 && L > 0) {
      const hits = windowStarts(seq, L, target);
      if (hits.length) {
        let off = hits[0]! - f.start;
        for (const h of hits) if (Math.abs(h - f.start) < Math.abs(off)) off = h - f.start;
        if (Math.abs(off) <= 60) {
          const cur = computeRegion(g, region);
          const dlen = b1.length_bp - (cur?.length ?? 0);
          return {
            changeType: "correction",
            diffClass: "coordinates_differ_origin_unresolved",
            reason: `Build-1 value reproduces a window of the cited sequence offset ${off} bp from the current feature start (length diff ${dlen} bp); 2015 annotation not retrievable, so upstream re-annotation vs build-1 extraction error is unresolved`,
            scope: "row",
          };
        }
      }
    }
  }
  return { changeType: "correction", diffClass: "build1_disagrees_with_cited_record", reason: REASONS.disagrees, scope: "row" };
}

const fmt = (v: number) => String(v);
const rowText = (v: Vals) => `length_bp=${v.length_bp};a=${v.a};c=${v.c};g=${v.g};t=${v.t}`;

export function diffGenome(inp: GenomeDiffInput): GenomeDiff {
  const changes: RowChange[] = [];
  const aggregates: { region: Region; c: Classification }[] = [];
  const removed: string[] = [];
  const emitted = new Map(inp.emittedStats.map((s) => [s.region, s]));
  const acc = inp.accessionChange;
  const accClass = (what: string): Classification => ({
    changeType: "value_update",
    diffClass: acc!.kind,
    reason:
      acc!.kind === "refseq_successor"
        ? `RefSeq ${acc!.from} was suppressed; build 2 uses the live RefSeq mitogenome of the same species ${acc!.to} (${what})`
        : `RefSeq sequence version changed ${acc!.from} -> ${acc!.to} (${what})`,
    scope: "row",
  });

  // ---------------- region_stats
  const mismatch = new Map<Region, { b1: Vals; cur: Vals; c: Classification }>();
  const dupRegions = new Set<Region>();
  const gapRegions = new Set<Region>();
  for (const [region, rows] of inp.csvComposition) {
    const cur = emitted.get(region);
    const key = `${inp.id}:${region}`;
    if (!cur) {
      removed.push(`region_stats:${key}`);
      const b1 = valsOfCsv(inp.id, region, rows[0]!);
      const c = acc
        ? accClass("region not annotated in the new record; build 1 row kept as retired")
        : { changeType: "value_update" as const, diffClass: "region_absent_in_current_record", reason: "Region of the build-1 CSV is not annotated in the current RefSeq record; build 1 row kept as retired", scope: "row" as const };
      changes.push({ table: "region_stats", rowKey: key, field: "(row)", oldValue: rowText(b1), newValue: null, ...c });
      continue;
    }
    const cv = valsOfStats(cur);
    if (rows.length > 1) {
      dupRegions.add(region);
      for (const r of rows) {
        const b1 = valsOfCsv(inp.id, region, r);
        if (sameAcgt(b1, cv)) continue;
        changes.push({
          table: "region_stats", rowKey: key, field: "(row)", oldValue: rowText(b1), newValue: "dropped (duplicate)",
          changeType: "correction", diffClass: "duplicate_csv_row", reason: REASONS.duplicate, scope: "rule",
        });
      }
      continue;
    }
    const b1 = valsOfCsv(inp.id, region, rows[0]!);
    if (sameAcgt(b1, cv) && b1.other === cv.other) continue;
    const c = acc ? accClass("values recomputed from the new record") : classifyRegion(inp, region, b1);
    mismatch.set(region, { b1, cur: cv, c });
  }
  for (const s of inp.emittedStats) {
    if (inp.csvComposition.has(s.region)) continue;
    gapRegions.add(s.region);
    const c: Classification = acc
      ? accClass("region absent from build 1, annotated in the new record")
      : { changeType: "correction", diffClass: "gap_fill_from_refseq", reason: REASONS.gapFill, scope: "rule" };
    changes.push({
      table: "region_stats", rowKey: `${inp.id}:${s.region}`, field: "(row)", oldValue: null,
      newValue: `length_bp=${s.lengthBp};gc_percent=${s.gcPercent}`, ...c,
    });
  }
  if (!acc) {
    // Aggregates inherit the classes of their differing member regions.
    for (const [region, m] of mismatch) {
      const members = AGG_MEMBERS[region];
      if (!members || m.c.diffClass === "upstream_reannotation_same_version") continue;
      const sub: { region: Region; cls: string; dlen: number }[] = [];
      for (const r of members) {
        const mm = mismatch.get(r);
        if (mm && !dupRegions.has(r)) sub.push({ region: r, cls: mm.c.diffClass, dlen: mm.b1.length_bp - mm.cur.length_bp });
        else if (gapRegions.has(r)) sub.push({ region: r, cls: "gap_fill_from_refseq", dlen: -emitted.get(r)!.lengthBp });
      }
      if (sub.length === 0) continue;
      const classes = [...new Set(sub.map((s) => s.cls))].sort((a, b) => GENE_CLS_ORDER.indexOf(a) - GENE_CLS_ORDER.indexOf(b));
      const dsum = sub.reduce((s, x) => s + x.dlen, 0);
      m.c = {
        changeType: classes.some((c) => CORRECTION_CLASSES.has(c)) ? "correction" : "value_update",
        diffClass: `derived_from_${classes.join("+")}`,
        reason: `Aggregate of member regions with differences (${sub.map((s) => s.region).join(", ")}; their length differences sum to ${dsum} bp, aggregate differs by ${m.b1.length_bp - m.cur.length_bp} bp)`,
        scope: classes.every((c) => c === "rule_full_span" || c === "gap_fill_from_refseq") ? "rule" : "row",
      };
    }
  }
  for (const [region, m] of mismatch) {
    if (region in AGG_MEMBERS) aggregates.push({ region, c: m.c });
    for (const f of RF) {
      if (m.b1[f] === m.cur[f]) continue;
      changes.push({ table: "region_stats", rowKey: `${inp.id}:${region}`, field: f, oldValue: fmt(m.b1[f]), newValue: fmt(m.cur[f]), ...m.c });
    }
  }

  // ---------------- codon_usage
  const emittedCodons = new Map(inp.emittedCodons.map((u) => [u.region as string, u.counts]));
  const codonMismatch = new Map<string, boolean>();
  for (const [region, counts] of inp.csvCodons) {
    const cur = emittedCodons.get(region);
    if (!cur) continue;
    codonMismatch.set(region, !CODONS.every((c) => (counts[c] ?? 0) === (cur[c] ?? 0)));
  }
  const codonClass = (region: string): Classification => {
    if (acc) return accClass("codons recounted from the new record");
    const b1 = inp.csvCodons.get(region)!;
    if (inp.primary && region !== "total_pc") {
      const p = computeGeneCodons(inp.primary.genome, region as (typeof PROTEIN_GENES)[number]);
      if (p && CODONS.every((c) => (p[c] ?? 0) === (b1[c] ?? 0))) {
        return {
          changeType: "value_update",
          diffClass: "upstream_reannotation_same_version",
          reason: "Build-1 codon counts equal the source INSDC record; the RefSeq CDS was re-annotated after build 1 (same accession.version)",
          scope: "row",
        };
      }
    }
    if (region === "total_pc") {
      const genes = PROTEIN_GENES.filter((g) => inp.csvCodons.has(g));
      const sum = (c: string) => genes.reduce((s, g) => s + (inp.csvCodons.get(g)![c] ?? 0), 0);
      const isSum = genes.length > 0 && CODONS.every((c) => (b1[c] ?? 0) === sum(c));
      const diffGenes = genes.filter((g) => codonMismatch.get(g));
      const gapGenes = PROTEIN_GENES.filter((g) => !inp.csvCodons.has(g) && emittedCodons.has(g));
      if (isSum && (diffGenes.length || gapGenes.length)) {
        const cl = [...new Set([...diffGenes.map((g) => codonClass(g).diffClass), ...(gapGenes.length ? ["gap_fill_from_refseq"] : [])])].sort();
        return {
          changeType: cl.every((c) => c.startsWith("upstream")) ? "value_update" : "correction",
          diffClass: `derived_from_${cl.join("+")}`,
          reason: `Build-1 total_pc equals the sum of its gene rows; differs because of gene-level differences in ${[...diffGenes, ...gapGenes].join(", ")}${gapGenes.length ? ` (gene rows missing from build 1: ${gapGenes.join(", ")})` : ""}`,
          scope: cl.length === 1 && cl[0] === "gap_fill_from_refseq" ? "rule" : "row",
        };
      }
      if (genes.length > 0 && !isSum) {
        return {
          changeType: "correction",
          diffClass: "build1_total_pc_not_sum_of_genes",
          reason: "Build-1 total_pc codon counts are not the sum of the build-1 gene rows and do not match the cited record",
          scope: "row",
        };
      }
    }
    const g = mismatch.get(region as Region);
    if (g && !dupRegions.has(region as Region) && g.c.diffClass !== "rule_full_span") {
      return { ...g.c, reason: `Same classification as the base-composition difference of this gene: ${g.c.reason}` };
    }
    return {
      changeType: "correction",
      diffClass: "build1_disagrees_with_cited_record",
      reason: "Build-1 codon counts are not reproducible from the cited RefSeq CDS (base composition of the gene matches or is not diagnostic)",
      scope: "row",
    };
  };
  for (const [region, diff] of codonMismatch) {
    if (!diff) continue;
    const c = codonClass(region);
    const b1 = inp.csvCodons.get(region)!;
    const cur = emittedCodons.get(region)!;
    for (const cd of CODONS) {
      if ((b1[cd] ?? 0) === (cur[cd] ?? 0)) continue;
      changes.push({ table: "codon_usage", rowKey: `${inp.id}:${region}`, field: cd, oldValue: fmt(b1[cd] ?? 0), newValue: fmt(cur[cd] ?? 0), ...c });
    }
  }
  for (const [region, cur] of emittedCodons) {
    if (inp.csvCodons.has(region)) continue;
    const total = CODONS.reduce((s, c) => s + (cur[c] ?? 0), 0);
    const c: Classification = acc
      ? accClass("codon row absent from build 1, present in the new record")
      : { changeType: "correction", diffClass: "gap_fill_from_refseq", reason: "Codon row missing from build-1 CSV; counted from the cited RefSeq CDS annotation", scope: "rule" };
    changes.push({ table: "codon_usage", rowKey: `${inp.id}:${region}`, field: "(row)", oldValue: null, newValue: `codons=${total}`, ...c });
  }
  for (const region of inp.csvCodons.keys()) {
    if (emittedCodons.has(region)) continue;
    removed.push(`codon_usage:${inp.id}:${region}`);
    const c = acc
      ? accClass("gene not annotated in the new record; build 1 row kept as retired")
      : { changeType: "value_update" as const, diffClass: "region_absent_in_current_record", reason: "Gene of the build-1 CSV is not annotated in the current RefSeq record; build 1 row kept as retired", scope: "row" as const };
    changes.push({ table: "codon_usage", rowKey: `${inp.id}:${region}`, field: "(row)", oldValue: "present", newValue: null, ...c });
  }

  // ---------------- genome_features (keyed name#n in genome order)
  const keyed = (fs: GenomeFeature[]) => {
    const n = new Map<string, number>();
    const out = new Map<string, GenomeFeature>();
    for (const f of fs) {
      const k = `${f.name}|${f.type}`;
      const i = (n.get(k) ?? 0) + 1;
      n.set(k, i);
      out.set(`${f.name}#${i}`, f);
    }
    return out;
  };
  const before = keyed(inp.baselineFeatures);
  const after = keyed(inp.emittedFeatures);
  const fc: Classification = acc
    ? accClass("feature table of the new record")
    : {
        changeType: "value_update",
        diffClass: "upstream_reannotation_same_version",
        reason: "Feature coordinates differ between the record cached for build 1 and the same accession.version in the pinned RefSeq release",
        scope: "row",
      };
  const span = (f: GenomeFeature) => `${f.start}..${f.end}(${f.strand})`;
  for (const k of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const o = before.get(k);
    const n = after.get(k);
    const rowKey = `${inp.id}:${k}`;
    if (o && !n) {
      removed.push(`genome_features:${rowKey}`);
      changes.push({ table: "genome_features", rowKey, field: "(row)", oldValue: span(o), newValue: null, ...fc });
    } else if (!o && n) {
      changes.push({ table: "genome_features", rowKey, field: "(row)", oldValue: null, newValue: span(n), ...fc });
    } else if (o && n) {
      for (const f of ["start", "end", "strand", "type"] as const) {
        if (o[f] !== n[f]) changes.push({ table: "genome_features", rowKey, field: f, oldValue: String(o[f]), newValue: String(n[f]), ...fc });
      }
    }
  }
  return { changes, aggregates, removed };
}

/** Feature row key name#n for each feature, in the order given (genome order). */
export function featureKeys(fs: GenomeFeature[]): string[] {
  const n = new Map<string, number>();
  return fs.map((f) => {
    const k = `${f.name}|${f.type}`;
    const i = (n.get(k) ?? 0) + 1;
    n.set(k, i);
    return `${f.name}#${i}`;
  });
}
