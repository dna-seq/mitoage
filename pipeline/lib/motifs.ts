/**
 * Non-B DNA motifs and simple sequence repeats in a mitochondrial genome.
 *
 * These are sequence-pattern counts, not thermodynamic predictions: a G-quadruplex motif is a run
 * pattern that *can* form a quadruplex, and a homopurine tract is a candidate for triplex formation.
 * The literature this follows (Toren et al. 2021, Mech Ageing Dev; the ImtRDB repeat classes) treats
 * such motif counts as per-genome features, and that is all they are claimed to be here.
 *
 * The sequence is treated as linear: a motif spanning the origin of a circular genome is not found,
 * which matches the repeat finder in lib/repeats.ts. Bases other than A, C, G and T break a motif.
 */

/** Minimum run of one base counted as a homopolymer. */
export const HOMOPOLYMER_MIN = 5;
/** Minimum length of a homopurine or homopyrimidine tract counted as triplex-forming. */
export const TRACT_MIN = 15;
/** Minimum number of whole units in a short tandem repeat. */
export const STR_MIN_UNITS = 3;

export interface MotifCounts {
  /** G-quadruplex motifs: four G-runs of >= 3, loops of 1 to 7 bases. */
  g4Forward: number;
  /** The same pattern read on the other strand (C-runs on this one). */
  g4Reverse: number;
  purineTracts: number;
  pyrimidineTracts: number;
  homopolymerRuns: number;
  /** Longest run of a single base, null when none reaches HOMOPOLYMER_MIN. */
  longestHomopolymer: number | null;
  strDinucleotide: number;
  strTrinucleotide: number;
  strTetranucleotide: number;
  /** Total bases covered by the counted short tandem repeats. */
  strBases: number;
}

const G4_FORWARD = /G{3,}[ACGT]{1,7}G{3,}[ACGT]{1,7}G{3,}[ACGT]{1,7}G{3,}/g;
const G4_REVERSE = /C{3,}[ACGT]{1,7}C{3,}[ACGT]{1,7}C{3,}[ACGT]{1,7}C{3,}/g;
const PURINE = new RegExp(`[AG]{${TRACT_MIN},}`, "g");
const PYRIMIDINE = new RegExp(`[CT]{${TRACT_MIN},}`, "g");
const HOMOPOLYMER = new RegExp(`(A{${HOMOPOLYMER_MIN},}|C{${HOMOPOLYMER_MIN},}|G{${HOMOPOLYMER_MIN},}|T{${HOMOPOLYMER_MIN},})`, "g");

function countMatches(s: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(s) !== null) n++;
  return n;
}

/**
 * Perfect short tandem repeats of the given unit length with at least STR_MIN_UNITS whole units.
 * A run whose unit is itself a repetition of a shorter unit (AAAAAA as a dinucleotide) is left to
 * the shorter unit length, so the three counts do not double-count the same bases.
 */
export function tandemRepeats(sequence: string, unit: number): { count: number; bases: number } {
  const s = sequence.toUpperCase();
  const re = new RegExp(`([ACGT]{${unit}})\\1{${STR_MIN_UNITS - 1},}`, "g");
  let count = 0;
  let bases = 0;
  for (const m of s.matchAll(re)) {
    const motif = m[1]!;
    // Reject a unit built from a shorter period: it belongs to that unit length instead.
    let periodic = false;
    for (let p = 1; p < unit; p++) {
      if (unit % p !== 0) continue;
      if (motif === motif.slice(0, p).repeat(unit / p)) periodic = true;
    }
    if (periodic) continue;
    count++;
    bases += m[0]!.length;
  }
  return { count, bases };
}

export function countMotifs(sequence: string): MotifCounts {
  const s = sequence.toUpperCase();
  HOMOPOLYMER.lastIndex = 0;
  let longest = 0;
  let runs = 0;
  for (const m of s.matchAll(HOMOPOLYMER)) {
    runs++;
    longest = Math.max(longest, m[0]!.length);
  }
  const di = tandemRepeats(s, 2);
  const tri = tandemRepeats(s, 3);
  const tetra = tandemRepeats(s, 4);
  return {
    g4Forward: countMatches(s, G4_FORWARD),
    g4Reverse: countMatches(s, G4_REVERSE),
    purineTracts: countMatches(s, PURINE),
    pyrimidineTracts: countMatches(s, PYRIMIDINE),
    homopolymerRuns: runs,
    longestHomopolymer: longest === 0 ? null : longest,
    strDinucleotide: di.count,
    strTrinucleotide: tri.count,
    strTetranucleotide: tetra.count,
    strBases: di.bases + tri.bases + tetra.bases,
  };
}
