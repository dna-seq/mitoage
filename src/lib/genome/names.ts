/**
 * Display names for genome-map features (genes, rRNAs, tRNAs, the D-loop). Safe for islands.
 */
import type { FeatureType, Region } from "~/data/schema";
import { GENE_PAGE_REGIONS, REGION_INFO } from "~/lib/genes";

const AA_BY_THREE: Record<string, { one: string; name: string }> = {
  Ala: { one: "A", name: "alanine" },
  Arg: { one: "R", name: "arginine" },
  Asn: { one: "N", name: "asparagine" },
  Asp: { one: "D", name: "aspartate" },
  Cys: { one: "C", name: "cysteine" },
  Gln: { one: "Q", name: "glutamine" },
  Glu: { one: "E", name: "glutamate" },
  Gly: { one: "G", name: "glycine" },
  His: { one: "H", name: "histidine" },
  Ile: { one: "I", name: "isoleucine" },
  Leu: { one: "L", name: "leucine" },
  Lys: { one: "K", name: "lysine" },
  Met: { one: "M", name: "methionine" },
  Phe: { one: "F", name: "phenylalanine" },
  Pro: { one: "P", name: "proline" },
  Ser: { one: "S", name: "serine" },
  Thr: { one: "T", name: "threonine" },
  Trp: { one: "W", name: "tryptophan" },
  Tyr: { one: "Y", name: "tyrosine" },
  Val: { one: "V", name: "valine" },
};

/**
 * Leucine and serine have two tRNAs each; the numbering follows the human gene symbols
 * (MT-TL1 = Leu(UUR), MT-TL2 = Leu(CUN), MT-TS1 = Ser(UCN), MT-TS2 = Ser(AGY)).
 */
const ISO_SUFFIX: Record<string, string> = { UUR: "1", CUN: "2", UCN: "1", AGY: "2" };

const parseTrna = (name: string): { three: string; codon: string } | null => {
  const m = /^tRNA-([A-Z][a-z]{2})(?:\(([A-Z]+)\))?$/.exec(name);
  return m ? { three: m[1] ?? "", codon: m[2] ?? "" } : null;
};

/** One-letter code of a tRNA, "L1"/"L2"/"S1"/"S2" for the two leucine and serine tRNAs. */
export const trnaLetter = (name: string): string => {
  const p = parseTrna(name);
  if (!p) return "?";
  const one = AA_BY_THREE[p.three]?.one ?? "?";
  return one + (p.codon ? (ISO_SUFFIX[p.codon] ?? "") : "");
};

/** Short label drawn on the map: "ND1", "12S", "16S", "D-loop", tRNA one-letter codes. */
export const mapLabel = (name: string, type: FeatureType): string => {
  if (type === "tRNA") return trnaLetter(name);
  if (name === "rRNA-12S") return "12S";
  if (name === "rRNA-16S") return "16S";
  if (name === "D_Loop") return "D-loop";
  return name;
};

/** Display symbol: "ND1", "12S rRNA", "D-loop", "tRNA-Leu (UUR)". */
export const featureSymbol = (name: string): string => {
  if (name === "rRNA-12S") return "12S rRNA";
  if (name === "rRNA-16S") return "16S rRNA";
  if (name === "D_Loop") return "D-loop";
  return name.replace(/\(([A-Z]+)\)$/, " ($1)");
};

/** Full name: "NADH dehydrogenase subunit 1", "Transfer RNA for leucine (codons UUR)". */
export const featureFullName = (name: string, type: FeatureType): string => {
  if (type === "tRNA") {
    const p = parseTrna(name);
    const aa = p ? AA_BY_THREE[p.three]?.name : undefined;
    if (!aa) return "Transfer RNA";
    return `Transfer RNA for ${aa}${p?.codon ? ` (codons ${p.codon})` : ""}`;
  }
  const info = (REGION_INFO as Record<string, { name: string } | undefined>)[name];
  return info?.name ?? name;
};

export const FEATURE_KIND: Record<FeatureType, string> = {
  CDS: "Protein-coding gene",
  rRNA: "Ribosomal RNA",
  tRNA: "Transfer RNA",
  "D-loop": "Control region",
};

/** CSS class suffix and colour token of a feature type. */
export const FEATURE_CLASS: Record<FeatureType, "cds" | "rrna" | "trna" | "dloop"> = {
  CDS: "cds",
  rRNA: "rrna",
  tRNA: "trna",
  "D-loop": "dloop",
};

export const FEATURE_COLOR: Record<FeatureType, string> = {
  CDS: "var(--feat-cds)",
  rRNA: "var(--feat-rrna)",
  tRNA: "var(--feat-trna)",
  "D-loop": "var(--feat-dloop)",
};

const PAGE_SET = new Set<string>(GENE_PAGE_REGIONS);

/** True when the feature name is one of the 16 regions with a gene page. */
export const hasGenePage = (name: string): name is Region => PAGE_SET.has(name);
