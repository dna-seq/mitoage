/**
 * Overlap alignment of two DNA sequences: the best-scoring alignment in which the ends of either sequence may
 * hang over for free, so a fragment of a gene is placed inside the gene, and a record that runs past the gene is
 * placed across it. It gives the share of identical bases over the columns where both have A, C, G or T.
 *
 * Used to compare a record's gene with an independent sequence of the same species (pipeline/screen.ts), where
 * the two are near-identical or the comparison is not read; it is not a general aligner.
 */
const MATCH = 2;
const MISMATCH = -3;
const GAP = -5;

const CODE: Record<string, number> = { A: 0, C: 1, G: 2, T: 3, U: 3 };
const COMPLEMENT: Record<string, string> = { A: "T", C: "G", G: "C", T: "A", U: "A", R: "Y", Y: "R", K: "M", M: "K", S: "S", W: "W", B: "V", V: "B", D: "H", H: "D", N: "N" };

/** Upper-case letters only; anything that is not a letter (gaps, spaces, digits) is dropped. */
export const cleanDna = (s: string): string => s.toUpperCase().replace(/[^A-Z]/g, "");

export function reverseComplement(s: string): string {
  let out = "";
  for (let i = s.length - 1; i >= 0; i--) out += COMPLEMENT[s[i]!] ?? "N";
  return out;
}

export interface Overlap {
  /** Columns where both sequences have A, C, G or T. */
  sites: number;
  /** Of those, the columns with the same base. */
  same: number;
  /** same / sites; null when no column is shared. */
  identity: number | null;
  /** Gap columns inside the overlap (either sequence). */
  gaps: number;
}

const encode = (s: string): Int8Array => {
  const out = new Int8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = CODE[s[i]!] ?? -1;
  return out;
};

/**
 * The overlap alignment of `a` and `b`, both cleaned DNA on the same strand. A base other than A, C, G, T scores
 * as a mismatch and is not counted as a site.
 */
export function overlap(a: string, b: string): Overlap {
  const x = encode(a);
  const y = encode(b);
  const n = x.length;
  const m = y.length;
  if (n === 0 || m === 0) return { sites: 0, same: 0, identity: null, gaps: 0 };
  const w = m + 1;
  // score and move (0 diagonal, 1 up: gap in b, 2 left: gap in a) for every cell
  const score = new Int32Array((n + 1) * w); // first row and column stay 0: leading overhang is free
  const move = new Uint8Array((n + 1) * w);
  for (let i = 1; i <= n; i++) {
    const xi = x[i - 1]!;
    const row = i * w;
    const prev = row - w;
    for (let j = 1; j <= m; j++) {
      const yj = y[j - 1]!;
      let best = score[prev + j - 1]! + (xi >= 0 && xi === yj ? MATCH : MISMATCH);
      let mv = 0;
      const up = score[prev + j]! + GAP;
      if (up > best) { best = up; mv = 1; }
      const left = score[row + j - 1]! + GAP;
      if (left > best) { best = left; mv = 2; }
      score[row + j] = best;
      move[row + j] = mv;
    }
  }
  // trailing overhang is free: the best cell of the last row or the last column
  let bi = n;
  let bj = m;
  let best = score[n * w + m]!;
  for (let j = 0; j <= m; j++) if (score[n * w + j]! > best) { best = score[n * w + j]!; bi = n; bj = j; }
  for (let i = 0; i <= n; i++) if (score[i * w + m]! > best) { best = score[i * w + m]!; bi = i; bj = m; }
  let sites = 0;
  let same = 0;
  let gaps = 0;
  let i = bi;
  let j = bj;
  while (i > 0 && j > 0) {
    const mv = move[i * w + j]!;
    if (mv === 0) {
      const xi = x[i - 1]!;
      const yj = y[j - 1]!;
      if (xi >= 0 && yj >= 0) { sites++; if (xi === yj) same++; }
      i--; j--;
    } else if (mv === 1) { gaps++; i--; }
    else { gaps++; j--; }
  }
  return { sites, same, identity: sites ? same / sites : null, gaps };
}

/** The overlap of `a` with `b` on whichever strand of `b` shares more identical bases. */
export function overlapEitherStrand(a: string, b: string): Overlap & { strand: 1 | -1 } {
  const f = overlap(a, b);
  const r = overlap(a, reverseComplement(b));
  return r.same > f.same ? { ...r, strand: -1 } : { ...f, strand: 1 };
}
