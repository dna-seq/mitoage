/**
 * Adds the hand-checked annotations of `pipeline/sources/gene-annotation.ts` to a parsed record, so every
 * reader of the record (the genome tables, the extended features, the alignments) sees the same genes.
 */
import type { ProteinGene } from "../../src/data/schema";
import { ANNOTATION_PATCHES, type AnnotationPatch } from "../sources/gene-annotation";
import { type GbRecord, extractFeature, parseLocation } from "./genbank";
import { geneticCode } from "./genetic-code";
import { normaliseFeature } from "./names";

const PRODUCT: Record<ProteinGene, string> = {
  ATP6: "ATP synthase F0 subunit 6", ATP8: "ATP synthase F0 subunit 8",
  COX1: "cytochrome c oxidase subunit I", COX2: "cytochrome c oxidase subunit II", COX3: "cytochrome c oxidase subunit III",
  CYTB: "cytochrome b",
  ND1: "NADH dehydrogenase subunit 1", ND2: "NADH dehydrogenase subunit 2", ND3: "NADH dehydrogenase subunit 3",
  ND4: "NADH dehydrogenase subunit 4", ND4L: "NADH dehydrogenase subunit 4L", ND5: "NADH dehydrogenase subunit 5",
  ND6: "NADH dehydrogenase subunit 6",
};

/** The genetic code the record's own CDS features name (the most common), or `fallback`; refuses when there is neither. */
export function recordTable(rec: GbRecord, fallback: number | null): number {
  const n = new Map<number, number>();
  for (const f of rec.features) {
    if (f.key !== "CDS") continue;
    const t = Number(f.qualifiers["transl_table"]?.[0]);
    if (Number.isFinite(t) && t > 0) n.set(t, (n.get(t) ?? 0) + 1);
  }
  let best = fallback;
  let c = 0;
  for (const [t, k] of [...n].sort((a, b) => a[0] - b[0])) if (k > c) [best, c] = [t, k];
  if (best === null) throw new Error(`${rec.accessionVersion}: the record names no genetic code and none was given`);
  return best;
}

/**
 * Translate a patched coding sequence and refuse it unless it is one open reading frame: whole codons, no
 * stop before the last codon, and a stop codon at the end. The first codon reads as methionine, as the
 * mitochondrial start codons (ATA, ATT, GTG...) are initiators.
 */
export function translatePatch(cds: string, table: number, label: string): string {
  if (cds.length % 3 !== 0) throw new Error(`${label}: ${cds.length} nt is not whole codons`);
  const code = geneticCode(table);
  let protein = "";
  for (let i = 0; i < cds.length; i += 3) {
    const aa = code[cds.slice(i, i + 3).replace(/T/g, "U")];
    if (!aa) throw new Error(`${label}: codon ${cds.slice(i, i + 3)} at ${i / 3 + 1} is not a plain codon`);
    protein += aa;
  }
  const stop = protein.indexOf("*");
  if (stop !== protein.length - 1) {
    throw new Error(stop < 0 ? `${label}: no stop codon at the end` : `${label}: stop codon at codon ${stop + 1} of ${protein.length}`);
  }
  return "M" + protein.slice(1, -1);
}

/**
 * Apply the patches for this record's accession.version. Refuses a patch whose gene the record already
 * annotates (RefSeq caught up: remove the patch) or whose location is not a clean reading frame.
 * Returns the genes added.
 */
export function applyGenePatches(rec: GbRecord, fallbackTable: number | null, patches: readonly AnnotationPatch[] = ANNOTATION_PATCHES): ProteinGene[] {
  const mine = patches.filter((p) => p.accession === rec.accessionVersion);
  if (!mine.length) return [];
  const table = recordTable(rec, fallbackTable);
  const added: ProteinGene[] = [];
  for (const p of mine) {
    const label = `annotation patch ${p.accession} ${p.gene}`;
    if (rec.features.some((f) => f.key === "CDS" && normaliseFeature(f)?.name === p.gene)) {
      throw new Error(`${label}: the record now annotates ${p.gene} itself; remove the patch from pipeline/sources/gene-annotation.ts`);
    }
    const { segments, partial } = parseLocation(p.location);
    if (!segments.length || partial) throw new Error(`${label}: location ${p.location} is empty or partial`);
    if (segments.some((s) => s.start < 1 || s.end > rec.sequence.length || s.start > s.end)) {
      throw new Error(`${label}: location ${p.location} is outside the ${rec.sequence.length} bp record`);
    }
    const translation = translatePatch(extractFeature(rec.sequence, segments), table, label);
    rec.features.push({
      key: "CDS",
      location: p.location,
      segments,
      partial: false,
      qualifiers: {
        gene: [p.gene],
        product: [PRODUCT[p.gene]],
        transl_table: [String(table)],
        codon_start: ["1"],
        note: [`annotated by MitoAge, not by the record: ${p.evidence}`],
        translation: [translation],
      },
    });
    added.push(p.gene);
  }
  return added;
}
