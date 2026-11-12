/**
 * Normalisation of mitochondrial feature names across the many synonyms used in
 * GenBank/RefSeq annotations (COI/COX1/CO1, ATPase6, cob, s-rRNA/rrnS, trnL1, ...).
 */
import type { FeatureType, ProteinGene } from "../../src/data/schema";

export interface NormalisedName {
  name: string;
  type: FeatureType;
  /** How a tRNA isoacceptor (Leu/Ser) was resolved, for diagnostics. */
  via?: "anticodon" | "codons" | "name" | "numbering" | "unresolved";
}

const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6" };

const squash = (s: string) => s.toLowerCase().replace(/[\s_\-.'()]+/g, "");

/** Map a gene or product string to one of the 13 protein-coding genes. */
export function normaliseProteinGene(raw: string): ProteinGene | null {
  if (!raw) return null;
  let s = raw.toLowerCase().trim();
  s = s.replace(/^(putative|probable)\s+/, "").replace(/\s+protein$/, "");
  // Spelled-out products.
  let m = /nadh\b.*?(?:subunit|chain)\s*([1-6]l?|i{1,3}|ivl?|vi?)\b/.exec(s) ?? /^nadh\s*-?\s*([1-6]l?)$/.exec(s);
  if (m) {
    let n = m[1]!;
    const l = n.endsWith("l");
    if (l) n = n.slice(0, -1);
    n = ROMAN[n] ?? n;
    if (/^[1-6]$/.test(n)) {
      if (l && n === "4") return "ND4L";
      if (!l) return `ND${n}` as ProteinGene;
    }
  }
  m = /cytochrome\s*c\s*oxidase\s*(?:subunit|polypeptide|chain)?\s*(i{1,3}|[1-3])\b/.exec(s);
  if (m) return `COX${ROMAN[m[1]!] ?? m[1]}` as ProteinGene;
  if (/^cytochrome\s*b\b/.test(s) || /apocytochrome\s*b/.test(s)) return "CYTB";
  m = /atp\s*(?:synthase|ase)?\s*(?:f0|fo)?\s*(?:subunit|chain)?\s*(6|8)\b/.exec(s);
  if (m) return m[1] === "6" ? "ATP6" : "ATP8";

  const q = squash(s);
  const table: Record<string, ProteinGene> = {
    nd1: "ND1", nad1: "ND1", nadh1: "ND1", ndh1: "ND1", mtnd1: "ND1", nd1p: "ND1",
    nd2: "ND2", nad2: "ND2", nadh2: "ND2", ndh2: "ND2", mtnd2: "ND2",
    nd3: "ND3", nad3: "ND3", nadh3: "ND3", ndh3: "ND3", mtnd3: "ND3",
    nd4: "ND4", nad4: "ND4", nadh4: "ND4", ndh4: "ND4", mtnd4: "ND4",
    nd4l: "ND4L", nad4l: "ND4L", nadh4l: "ND4L", ndh4l: "ND4L", mtnd4l: "ND4L",
    nd5: "ND5", nad5: "ND5", nadh5: "ND5", ndh5: "ND5", mtnd5: "ND5",
    nd6: "ND6", nad6: "ND6", nadh6: "ND6", ndh6: "ND6", mtnd6: "ND6",
    cox1: "COX1", co1: "COX1", coi: "COX1", coxi: "COX1", cox: "COX1", mtco1: "COX1", cox1p: "COX1",
    cox2: "COX2", co2: "COX2", coii: "COX2", coxii: "COX2", mtco2: "COX2",
    cox3: "COX3", co3: "COX3", coiii: "COX3", coxiii: "COX3", mtco3: "COX3",
    atp6: "ATP6", atpase6: "ATP6", atp6p: "ATP6", a6: "ATP6", mtatp6: "ATP6", atpase6p: "ATP6",
    atp8: "ATP8", atpase8: "ATP8", atp8p: "ATP8", a8: "ATP8", mtatp8: "ATP8",
    cytb: "CYTB", cob: "CYTB", cyb: "CYTB", mtcyb: "CYTB", cytbp: "CYTB", cytochromeb: "CYTB",
  };
  return table[q] ?? null;
}

export function normaliseRrna(raw: string): "rRNA-12S" | "rRNA-16S" | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (/\b12\s*s\b|12s|s-rrna|\bsrrna\b|rrns\b|\brns\b|small\s+subunit|\bmt-?rnr1\b|\brnr1\b|s-rna/.test(s)) return "rRNA-12S";
  if (/\b16\s*s\b|16s|l-rrna|\blrrna\b|rrnl\b|\brnl\b|large\s+subunit|\bmt-?rnr2\b|\brnr2\b|l-rna/.test(s)) return "rRNA-16S";
  return null;
}

const AA3: Record<string, string> = {
  A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile",
  L: "Leu", K: "Lys", M: "Met", F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val",
};
const AA_NAMES: Record<string, string> = {
  alanine: "Ala", arginine: "Arg", asparagine: "Asn", aspartate: "Asp", "aspartic acid": "Asp",
  cysteine: "Cys", glutamine: "Gln", glutamate: "Glu", "glutamic acid": "Glu", glycine: "Gly",
  histidine: "His", isoleucine: "Ile", leucine: "Leu", lysine: "Lys", methionine: "Met",
  phenylalanine: "Phe", proline: "Pro", serine: "Ser", threonine: "Thr", tryptophan: "Trp",
  tyrosine: "Tyr", valine: "Val",
};
const THREE = new Set(Object.values(AA3));

function aminoAcidOfTrna(raw: string): string | null {
  const s = raw.trim();
  let m = /(?:t-?rna|transfer\s+rna)[\s-]*([A-Za-z]{3})\b/i.exec(s);
  if (m) {
    const t = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase();
    if (THREE.has(t)) return t;
  }
  m = /^(?:mt-?)?trn([A-Za-z])(?:\d|\b|-|$|\()/i.exec(s);
  if (m) return AA3[m[1]!.toUpperCase()] ?? null;
  const lower = s.toLowerCase();
  for (const [name, three] of Object.entries(AA_NAMES)) if (lower.includes(name)) return three;
  return null;
}

/** Isoacceptor of Leu/Ser tRNAs from an anticodon (DNA or RNA alphabet, 5'->3'). */
export function isoacceptorFromAnticodon(aa: string, anticodon: string): string | null {
  const ac = anticodon.toUpperCase().replace(/U/g, "T");
  if (aa === "Leu") {
    if (/^.AA$/.test(ac) || /^[TC]AA$/.test(ac)) return "UUR";
    if (/^.AG$/.test(ac)) return "CUN";
  }
  if (aa === "Ser") {
    if (/^.GA$/.test(ac)) return "UCN";
    if (/^.CT$/.test(ac)) return "AGY";
  }
  return null;
}

function isoacceptorFromText(aa: string, text: string): string | null {
  const t = text.toUpperCase().replace(/T/g, "U");
  if (aa === "Leu") {
    if (/UUR|UUA|UUG|UUN/.test(t)) return "UUR";
    if (/CUN|CUA|CUU|CUG|CUC/.test(t)) return "CUN";
  }
  if (aa === "Ser") {
    if (/UCN|UCA|UCU|UCG|UCC/.test(t)) return "UCN";
    if (/AGY|AGN|AGC|AGU|AGR|AGA/.test(t)) return "AGY";
  }
  return null;
}

export interface FeatureInput {
  key: string;
  qualifiers: Record<string, string[]>;
}

const q1 = (f: FeatureInput, k: string) => (f.qualifiers[k] ?? []).join(" ");

export function normaliseFeature(f: FeatureInput): NormalisedName | null {
  const gene = q1(f, "gene");
  const product = q1(f, "product");
  const note = q1(f, "note");
  const std = q1(f, "standard_name");
  const locusTag = q1(f, "locus_tag");

  if (f.key === "CDS") {
    for (const s of [gene, product, std, note, locusTag]) {
      const g = normaliseProteinGene(s);
      if (g) return { name: g, type: "CDS" };
    }
    return null;
  }
  if (f.key === "rRNA") {
    for (const s of [product, gene, std, note]) {
      const r = normaliseRrna(s);
      if (r) return { name: r, type: "rRNA" };
    }
    return null;
  }
  if (f.key === "tRNA") {
    let aa: string | null = null;
    for (const s of [product, gene, std, note]) {
      if (s && (aa = aminoAcidOfTrna(s))) break;
    }
    const anticodon = q1(f, "anticodon");
    if (!aa) {
      const m = /aa:([A-Za-z]{3})/.exec(anticodon);
      if (m) {
        const t = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase();
        if (THREE.has(t)) aa = t;
      }
    }
    if (!aa) return null;
    if (aa !== "Leu" && aa !== "Ser") return { name: `tRNA-${aa}`, type: "tRNA" };
    const acSeq = /seq:([a-z]{3})/i.exec(anticodon)?.[1];
    let iso = acSeq ? isoacceptorFromAnticodon(aa, acSeq) : null;
    let via: NormalisedName["via"] = "anticodon";
    if (!iso) {
      via = "codons";
      const codonsRecognized = q1(f, "codon_recognized");
      const m = /codons?\s+recogni[sz]ed:?\s*([ACGTUNRY]{3})/i.exec(note);
      iso = isoacceptorFromText(aa, codonsRecognized || m?.[1] || "");
    }
    if (!iso) {
      via = "name";
      for (const s of [product, gene]) {
        // MITOS style "trnL2(taa)" / "tRNA-Leu(tag)": a lower-case anticodon in parentheses.
        const ac = /\(([acgtu]{3})\)/.exec(s);
        if (ac) iso = isoacceptorFromAnticodon(aa, ac[1]!);
        // Codon family such as "tRNA-Leu (UUR)" or "tRNA-Ser(AGY)".
        const cf = /\(([ACGTUNRY]{3})\)/.exec(s) ?? /[-\s]([ACGTUNRY]{3})$/.exec(s);
        if (!iso && cf) iso = isoacceptorFromText(aa, cf[1]!);
        if (iso) break;
      }
    }
    if (!iso) {
      // HGNC / RefSeq convention (human): TRNL1 = Leu(UUR), TRNL2 = Leu(CUN),
      // TRNS1 = Ser(UCN), TRNS2 = Ser(AGY).
      via = "numbering";
      const m = /trn([LS])([12])\b|trna-?(leu|ser)[-\s]?([12])\b|t-?rna-?(leu|ser)\s*\(?([12])\)?$/i.exec(gene || product);
      if (m) {
        const n = m[2] ?? m[4] ?? m[6];
        iso = aa === "Leu" ? (n === "1" ? "UUR" : "CUN") : n === "1" ? "UCN" : "AGY";
      }
    }
    if (!iso) return { name: `tRNA-${aa}`, type: "tRNA", via: "unresolved" };
    return { name: `tRNA-${aa}(${iso})`, type: "tRNA", via };
  }
  if (f.key === "D-loop") return { name: "D_Loop", type: "D-loop" };
  if (f.key === "misc_feature" || f.key === "misc_RNA") {
    const text = `${note} ${std} ${product} ${gene}`.toLowerCase();
    if (/control\s+region|d-?loop|\bcr\b/.test(text) && !/pseudo|partial control|repeat/.test(text)) {
      return { name: "D_Loop", type: "D-loop" };
    }
  }
  return null;
}
