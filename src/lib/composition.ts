/** Base-composition helpers shared by CompositionBar, tables and islands. */

export interface BaseCounts {
  a: number;
  c: number;
  g: number;
  t: number;
  other?: number;
}

export type Nucleotide = "a" | "c" | "g" | "t" | "other";

export const NUCLEOTIDES: readonly { key: Nucleotide; label: string; className: string }[] = [
  { key: "a", label: "A", className: "nt-a" },
  { key: "t", label: "T", className: "nt-t" },
  { key: "g", label: "G", className: "nt-g" },
  { key: "c", label: "C", className: "nt-c" },
  { key: "other", label: "N", className: "nt-other" },
];

/** Percentages of each base (0-100) over the sum of all counts. */
export const basePercents = (b: BaseCounts): Record<Nucleotide, number> => {
  const other = b.other ?? 0;
  const total = b.a + b.c + b.g + b.t + other;
  const p = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return { a: p(b.a), c: p(b.c), g: p(b.g), t: p(b.t), other: p(other) };
};
