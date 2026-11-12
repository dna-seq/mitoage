/** Per-species genome annotation from RefSeq records: normalised features, sequences, codes. */
import type { GenomeFeature } from "../../src/data/schema";
import { type GbRecord, type Segment, extractFeature, parseGenBank } from "../lib/genbank";
import { normaliseFeature } from "../lib/names";

export interface AnnotatedFeature extends GenomeFeature {
  segments: Segment[];
  /** "annotation" for typed features, "control-region" for misc_feature control regions. */
  origin: "annotation" | "control-region";
  partial: boolean;
  codonStart: number;
  via?: string;
}

export interface SpeciesGenome {
  record: GbRecord;
  features: AnnotatedFeature[];
  translTable: number;
  taxid: number | null;
  unrecognised: string[];
}

/** Overall span of a feature on the circular genome; start > end when it wraps the origin. */
export function featureSpan(segments: Segment[], genomeLength: number): { start: number; end: number; strand: 1 | -1 } {
  const strand = segments[0]?.strand ?? 1;
  const genomic = strand === 1 ? segments : [...segments].reverse();
  let wraps = false;
  for (let i = 1; i < genomic.length; i++) if (genomic[i]!.start < genomic[i - 1]!.start) wraps = true;
  if (wraps) return { start: genomic[0]!.start, end: genomic[genomic.length - 1]!.end, strand };
  let start = Infinity;
  let end = -Infinity;
  for (const s of segments) {
    start = Math.min(start, s.start);
    end = Math.max(end, s.end);
  }
  return { start: Math.max(1, start), end: Math.min(genomeLength, end), strand };
}

/** Circular distance from position a forward to position b. */
const forward = (a: number, b: number, len: number) => (((b - a) % len) + len) % len;

/**
 * Resolve tRNA-Leu / tRNA-Ser copies whose isoacceptor could not be read from the
 * annotation, using the conserved vertebrate gene order: Leu(UUR) directly follows
 * 16S rRNA and Ser(UCN) directly follows COX1.
 */
function resolveByPosition(features: AnnotatedFeature[], len: number, useGeneOrder: boolean): void {
  const rules: [string, string, string, string][] = [
    ["Leu", "rRNA-16S", "UUR", "CUN"],
    ["Ser", "COX1", "UCN", "AGY"],
  ];
  for (const [aa, anchorName, nearIso, farIso] of rules) {
    // Names derived only from TRNL1/TRNL2-style numbering are unreliable (HGNC and MITOS
    // number them in opposite ways), so gene order takes precedence over them.
    const numbered = features.filter((f) => f.type === "tRNA" && f.via === "numbering" && f.name.startsWith(`tRNA-${aa}(`));
    const original = new Map(numbered.map((f) => [f, f.name]));
    for (const f of numbered) f.name = `tRNA-${aa}`;
    const plain = features.filter((f) => f.name === `tRNA-${aa}`);
    const resolved = features.filter((f) => f.name.startsWith(`tRNA-${aa}(`));
    const restore = () => {
      for (const [f, name] of original) if (f.name === `tRNA-${aa}`) f.name = name;
    };
    if (plain.length === 0) continue;
    const anchor = features.find((f) => f.name === anchorName);
    if (!anchor || !useGeneOrder) {
      restore();
      continue;
    }
    // Measure downstream from the anchor's 5' end, so a tRNA overlapping the anchor's 3' end still counts as adjacent.
    const anchorStart = anchor.strand === 1 ? anchor.start : anchor.end;
    if (plain.length === 2 && resolved.length === 0) {
      const d = plain.map((f) => {
        const pos = anchor.strand === 1 ? f.start : f.end;
        return anchor.strand === 1 ? forward(anchorStart, pos, len) : forward(pos, anchorStart, len);
      });
      const nearIdx = d[0]! <= d[1]! ? 0 : 1;
      plain[nearIdx]!.name = `tRNA-${aa}(${nearIso})`;
      plain[1 - nearIdx]!.name = `tRNA-${aa}(${farIso})`;
      plain[0]!.via = plain[1]!.via = "position";
    } else if (plain.length === 1 && resolved.length === 1) {
      const other = resolved[0]!.name.includes(nearIso) ? farIso : nearIso;
      plain[0]!.name = `tRNA-${aa}(${other})`;
      plain[0]!.via = "complement";
    } else {
      restore();
    }
  }
}

export function annotateGenome(text: string, fallbackTable: number, vertebrateGeneOrder = true): SpeciesGenome {
  const record = parseGenBank(text);
  const len = record.sequence.length;
  const features: AnnotatedFeature[] = [];
  const unrecognised: string[] = [];
  const tables = new Map<number, number>();
  let taxid: number | null = null;
  const controlRegions: AnnotatedFeature[] = [];

  for (const f of record.features) {
    if (f.key === "source") {
      const tx = (f.qualifiers["db_xref"] ?? []).find((x) => x.startsWith("taxon:"));
      if (tx) taxid = Number(tx.slice(6));
      continue;
    }
    if (!["CDS", "rRNA", "tRNA", "D-loop", "misc_feature"].includes(f.key)) continue;
    if (f.segments.length === 0) continue;
    const n = normaliseFeature(f);
    if (!n) {
      if (f.key !== "misc_feature") {
        unrecognised.push(`${f.key} ${f.qualifiers["gene"]?.[0] ?? ""} ${f.qualifiers["product"]?.[0] ?? ""}`.trim());
      }
      continue;
    }
    if (f.key === "CDS") {
      const t = Number(f.qualifiers["transl_table"]?.[0]);
      if (Number.isFinite(t) && t > 0) tables.set(t, (tables.get(t) ?? 0) + 1);
    }
    const span = featureSpan(f.segments, len);
    const af: AnnotatedFeature = {
      name: n.name,
      type: n.type,
      start: span.start,
      end: span.end,
      strand: span.strand,
      segments: f.segments,
      origin: f.key === "misc_feature" ? "control-region" : "annotation",
      partial: f.partial,
      codonStart: Number(f.qualifiers["codon_start"]?.[0] ?? 1) || 1,
      ...(n.via ? { via: n.via } : {}),
    };
    if (af.origin === "control-region") controlRegions.push(af);
    else features.push(af);
  }
  // Use misc_feature control regions only when the record has no D-loop feature.
  if (!features.some((f) => f.type === "D-loop")) features.push(...controlRegions);
  resolveByPosition(features, len, vertebrateGeneOrder);
  features.sort((a, b) => a.start - b.start || a.end - b.end);

  let translTable = fallbackTable;
  let best = 0;
  for (const [t, c] of tables) if (c > best) [translTable, best] = [t, c];
  return { record, features, translTable, taxid, unrecognised };
}

/** Positions (0-based) covered by the given features, as a bitmap over the genome. */
export function coverage(features: { segments: Segment[] }[], len: number): Uint8Array {
  const mask = new Uint8Array(len);
  for (const f of features) for (const s of f.segments) for (let p = s.start - 1; p < s.end && p < len; p++) mask[p] = 1;
  return mask;
}

/** Sequence of the covered positions on the RefSeq strand, in genome order. */
export function maskedSequence(seq: string, mask: Uint8Array): string {
  let out = "";
  for (let i = 0; i < mask.length; i++) if (mask[i]) out += seq[i];
  return out;
}

export { extractFeature };
