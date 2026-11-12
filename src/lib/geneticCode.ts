/**
 * Mitochondrial genetic codes used to group codons by amino acid in the codon-usage heatmap.
 * These are the standard NCBI translation tables (not data); counts always come from the data API.
 */

export const BASES = ["U", "C", "A", "G"] as const;

/** All 64 codons in the classic UUU, UUC, UUA ... GGG order. */
export const CODONS: string[] = BASES.flatMap((a) => BASES.flatMap((b) => BASES.map((c) => `${a}${b}${c}`)));

/** NCBI table 1 (standard) as a 64-letter string in CODONS order; '*' is a stop. */
const STANDARD = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";

const withChanges = (changes: Record<string, string>): string =>
  CODONS.map((c, i) => changes[c] ?? STANDARD[i] ?? "X").join("");

export interface GeneticCode {
  id: number;
  name: string;
  /** Codon -> one-letter amino acid ('*' = stop). */
  table: Record<string, string>;
}

const make = (id: number, name: string, changes: Record<string, string>): GeneticCode => {
  const s = withChanges(changes);
  const table: Record<string, string> = {};
  CODONS.forEach((c, i) => {
    table[c] = s[i] ?? "X";
  });
  return { id, name, table };
};

export const VERTEBRATE_MITO = make(2, "Vertebrate mitochondrial code (NCBI table 2)", {
  AGA: "*",
  AGG: "*",
  AUA: "M",
  UGA: "W",
});
export const INVERTEBRATE_MITO = make(5, "Invertebrate mitochondrial code (NCBI table 5)", {
  AGA: "S",
  AGG: "S",
  AUA: "M",
  UGA: "W",
});
export const ECHINODERM_MITO = make(9, "Echinoderm and flatworm mitochondrial code (NCBI table 9)", {
  AAA: "N",
  AGA: "S",
  AGG: "S",
  UGA: "W",
});

/** Pick the mitochondrial code for a phylum. */
export const codeForPhylum = (phylum: string): GeneticCode => {
  if (phylum === "Chordata") return VERTEBRATE_MITO;
  if (phylum === "Echinodermata" || phylum === "Platyhelminthes") return ECHINODERM_MITO;
  return INVERTEBRATE_MITO;
};

export const AMINO_ACIDS: Record<string, { three: string; name: string }> = {
  A: { three: "Ala", name: "Alanine" },
  R: { three: "Arg", name: "Arginine" },
  N: { three: "Asn", name: "Asparagine" },
  D: { three: "Asp", name: "Aspartate" },
  C: { three: "Cys", name: "Cysteine" },
  Q: { three: "Gln", name: "Glutamine" },
  E: { three: "Glu", name: "Glutamate" },
  G: { three: "Gly", name: "Glycine" },
  H: { three: "His", name: "Histidine" },
  I: { three: "Ile", name: "Isoleucine" },
  L: { three: "Leu", name: "Leucine" },
  K: { three: "Lys", name: "Lysine" },
  M: { three: "Met", name: "Methionine" },
  F: { three: "Phe", name: "Phenylalanine" },
  P: { three: "Pro", name: "Proline" },
  S: { three: "Ser", name: "Serine" },
  T: { three: "Thr", name: "Threonine" },
  W: { three: "Trp", name: "Tryptophan" },
  Y: { three: "Tyr", name: "Tyrosine" },
  V: { three: "Val", name: "Valine" },
  "*": { three: "Stop", name: "Stop codons" },
};

/** Display order of amino-acid groups in the heatmap. */
export const AA_ORDER = "FLIMVSPTAYHQNKDECWRG*".split("");

/** Codons grouped by amino acid, in AA_ORDER, each group in CODONS order. */
export const groupCodons = (code: GeneticCode): { aa: string; codons: string[] }[] =>
  AA_ORDER.map((aa) => ({ aa, codons: CODONS.filter((c) => code.table[c] === aa) })).filter(
    (g) => g.codons.length > 0,
  );
