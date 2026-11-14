/**
 * Perfect repeats in a DNA sequence: direct repeats (two copies on the same strand) and inverted
 * repeats (the second copy is the reverse complement of the first), of at least `minLength` bases.
 *
 * Every repeat pair is maximal (it cannot be extended on either side) and is reported once. The two
 * copies of a pair never overlap; tandem copies are reported as non-overlapping pairs. Bases other
 * than A, C, G and T break a repeat. The sequence is treated as linear: a repeat spanning the origin
 * of a circular genome is not found.
 */

export interface RepeatPair {
  /** 0-based start of the first copy. */
  first: number;
  /** 0-based start of the second copy (first < second). */
  second: number;
  length: number;
}

const ACGT = new Set(["A", "C", "G", "T"]);
const COMPLEMENT: Record<string, string> = { A: "T", C: "G", G: "C", T: "A" };
const IDENTITY: Record<string, string> = { A: "A", C: "C", G: "G", T: "T" };

function kmerIndex(s: string, k: number): Map<string, number[]> {
  const index = new Map<string, number[]>();
  let valid = 0; // length of the run of A/C/G/T ending at i
  for (let i = 0; i < s.length; i++) {
    valid = ACGT.has(s[i]!) ? valid + 1 : 0;
    if (valid >= k) {
      const start = i - k + 1;
      const kmer = s.slice(start, i + 1);
      const list = index.get(kmer);
      if (list) list.push(start);
      else index.set(kmer, [start]);
    }
  }
  return index;
}

/** Maximal, non-overlapping direct repeat pairs of at least `minLength` bases, sorted by position. */
export function directRepeats(sequence: string, minLength = 10): RepeatPair[] {
  const s = sequence.toUpperCase();
  const k = minLength;
  const out: RepeatPair[] = [];
  for (const positions of kmerIndex(s, k).values()) {
    for (let x = 0; x < positions.length; x++) {
      for (let y = x + 1; y < positions.length; y++) {
        const a = positions[x]!;
        const b = positions[y]!;
        if (b - a < k) continue; // the seed copies overlap
        // Not left-maximal: the same pair starting one base earlier is counted instead.
        if (a > 0 && ACGT.has(s[a - 1]!) && s[a - 1] === s[b - 1]) continue;
        let len = k;
        while (b + len < s.length && a + len < b && ACGT.has(s[a + len]!) && s[a + len] === s[b + len]) len++;
        out.push({ first: a, second: b, length: len });
      }
    }
  }
  return out.sort((p, q) => p.first - q.first || p.second - q.second);
}

/**
 * Shared scan for repeats whose second copy is read backwards: the base at offset `t` of the first
 * copy pairs with the base at offset `len - 1 - t` of the second. `pair` maps a base to the base it
 * must meet there - the complement for an inverted repeat, the base itself for a mirror repeat.
 */
function backwardRepeats(sequence: string, minLength: number, pair: Record<string, string>): RepeatPair[] {
  const s = sequence.toUpperCase();
  const k = minLength;
  const n = s.length;
  const index = kmerIndex(s, k);
  const partner = (t: string) => [...t].reverse().map((c) => pair[c]!).join("");
  const out: RepeatPair[] = [];
  for (const [kmer, firsts] of index) {
    const seconds = index.get(partner(kmer));
    if (!seconds) continue;
    for (const a of firsts) {
      for (const b of seconds) {
        if (b < a + k) continue; // the second copy must lie wholly downstream of the first
        // Not outward-maximal: the arms extend by one base on the outside (seed a-1 pairs with b+k).
        if (a > 0 && b + k < n && ACGT.has(s[a - 1]!) && pair[s[a - 1]!] === s[b + k]) continue;
        // Extend inward (the first copy grows to the right, the second to the left) while the copies stay disjoint.
        let len = k;
        while (a + len < b + k - len - 1 && ACGT.has(s[a + len]!) && pair[s[a + len]!] === s[b + k - len - 1]) len++;
        out.push({ first: a, second: b + k - len, length: len });
      }
    }
  }
  return out.sort((p, q) => p.first - q.first || p.second - q.second);
}

/**
 * Maximal, non-overlapping inverted repeat pairs of at least `minLength` bases, sorted by position:
 * `second` is the start of the reverse-complement copy, which lies downstream of the first copy.
 */
export function invertedRepeats(sequence: string, minLength = 10): RepeatPair[] {
  return backwardRepeats(sequence, minLength, COMPLEMENT);
}

/**
 * Maximal, non-overlapping mirror repeat pairs of at least `minLength` bases: the second copy is the
 * first read backwards, without complementing. Mirror repeats are one of the non-B DNA motif classes
 * (they underlie intramolecular triplex formation) and are counted separately from inverted repeats,
 * which they are not a superset of.
 */
export function mirrorRepeats(sequence: string, minLength = 10): RepeatPair[] {
  return backwardRepeats(sequence, minLength, IDENTITY);
}

export interface RepeatSummary {
  direct: number;
  inverted: number;
  mirror: number;
  /** Length of the longest direct repeat, null when there is none. */
  longestDirect: number | null;
}

/** All three repeat classes of a sequence, found once and kept, so a caller can also read the pairs. */
export interface RepeatPairs {
  direct: RepeatPair[];
  inverted: RepeatPair[];
  mirror: RepeatPair[];
}

export function findRepeats(sequence: string, minLength = 10): RepeatPairs {
  return {
    direct: directRepeats(sequence, minLength),
    inverted: invertedRepeats(sequence, minLength),
    mirror: mirrorRepeats(sequence, minLength),
  };
}

export function summarisePairs(pairs: RepeatPairs): RepeatSummary {
  return {
    direct: pairs.direct.length,
    inverted: pairs.inverted.length,
    mirror: pairs.mirror.length,
    longestDirect: pairs.direct.length ? Math.max(...pairs.direct.map((p) => p.length)) : null,
  };
}

export function summariseRepeats(sequence: string, minLength = 10): RepeatSummary {
  return summarisePairs(findRepeats(sequence, minLength));
}
