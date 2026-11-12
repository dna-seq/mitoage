/** NCBI genetic codes used by animal mitochondria (tables 2, 4, 5, 9, 13, 14). */

const BASES = "UCAG";
// Standard code (table 1) in UCAG order.
const STANDARD = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";

/** All 64 codons in the canonical UCAG order. */
export const CODONS: string[] = [];
for (const a of BASES) for (const b of BASES) for (const c of BASES) CODONS.push(a + b + c);

const DIFFS: Record<number, Record<string, string>> = {
  1: {},
  // Vertebrate mitochondrial
  2: { AGA: "*", AGG: "*", AUA: "M", UGA: "W" },
  // Mold/protozoan/coelenterate mitochondrial
  4: { UGA: "W" },
  // Invertebrate mitochondrial
  5: { AGA: "S", AGG: "S", AUA: "M", UGA: "W" },
  // Echinoderm and flatworm mitochondrial
  9: { AAA: "N", AGA: "S", AGG: "S", UGA: "W" },
  // Ascidian mitochondrial
  13: { AGA: "G", AGG: "G", AUA: "M", UGA: "W" },
  // Alternative flatworm mitochondrial
  14: { AAA: "N", AGA: "S", AGG: "S", UAA: "Y", UGA: "W" },
};

export function geneticCode(table: number): Record<string, string> {
  const diffs = DIFFS[table];
  if (!diffs) throw new Error(`Unsupported genetic code table ${table}`);
  const code: Record<string, string> = {};
  CODONS.forEach((c, i) => {
    code[c] = diffs[c] ?? STANDARD[i]!;
  });
  return code;
}

/** The 20 amino acids in one-letter code plus "*" for stop. */
export const AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY".split("");

/** Sum codon counts into amino-acid counts ("*" for stops). */
export function aminoAcidCounts(counts: Record<string, number>, table: number): Record<string, number> {
  const code = geneticCode(table);
  const out: Record<string, number> = {};
  for (const aa of [...AMINO_ACIDS, "*"]) out[aa] = 0;
  for (const c of CODONS) out[code[c]!]! += counts[c] ?? 0;
  return out;
}

/** Count complete codons of an RNA/DNA coding sequence, starting at codon_start (1-based). */
export function countCodons(seq: string, codonStart = 1): { counts: Record<string, number>; ambiguous: number } {
  const counts: Record<string, number> = {};
  for (const c of CODONS) counts[c] = 0;
  let ambiguous = 0;
  const s = seq.toUpperCase().replace(/T/g, "U");
  for (let i = codonStart - 1; i + 3 <= s.length; i += 3) {
    const c = s.slice(i, i + 3);
    if (c in counts) counts[c]!++;
    else ambiguous++;
  }
  return { counts, ambiguous };
}
