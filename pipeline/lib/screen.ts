/**
 * The rules of the screen against independent sequences (RM25; pipeline/screen.ts): what a set of identities
 * between a record's gene and independent sequences of a species says. The thresholds were written before the
 * screen ran. A verdict other than "agrees" is a row for a person to read, not a finding: the independent
 * sequences can be the wrong ones.
 */

/** A comparison sharing fewer bases than this is not read. */
export const MIN_SITES = 300;
/** Below this identity the two are taken for different genes (or unalignable), and the comparison is not read. */
export const SAME_GENE_MIN = 0.65;
/** At or above this median identity to its own species' sequences a gene agrees. */
export const AGREE_MIN = 0.97;
/** Another species of the genus is the closer one when its sequences are at least this identical, and */
export const CLOSER_MIN = 0.98;
/** this much more identical than the record's own species' (difference of the medians). */
export const CLOSER_MARGIN = 0.01;

export interface Stat {
  n: number;
  median: number;
  max: number;
  min: number;
}

/** null for an empty list. The median of an even count is the mean of the two middle values. */
export function stat(identities: number[]): Stat | null {
  if (identities.length === 0) return null;
  const s = [...identities].sort((a, b) => a - b);
  const h = s.length >> 1;
  return { n: s.length, median: s.length % 2 ? s[h]! : (s[h - 1]! + s[h]!) / 2, max: s[s.length - 1]!, min: s[0]! };
}

export const GENE_VERDICTS = ["agrees", "mixed", "differs", "differs_one_sequence", "not_assessed"] as const;
export type GeneVerdict = (typeof GENE_VERDICTS)[number];

/** What the identities to the record's own species say about one gene. */
export function geneVerdict(own: Stat | null): GeneVerdict {
  if (!own) return "not_assessed";
  if (own.median >= AGREE_MIN) return "agrees";
  if (own.max >= AGREE_MIN) return "mixed";
  return own.n >= 2 ? "differs" : "differs_one_sequence";
}

/**
 * The other species of the genus whose independent sequences fit the record better than its own species' do,
 * or null. It needs at least one comparable sequence of the record's own species: without one, a close relative
 * that fits well says nothing.
 */
export function closerSpecies<T extends { stat: Stat }>(own: Stat | null, others: T[]): T | null {
  if (!own) return null;
  let best: T | null = null;
  for (const o of others) {
    if (o.stat.median < CLOSER_MIN || o.stat.median - own.median < CLOSER_MARGIN) continue;
    if (!best || o.stat.median > best.stat.median) best = o;
  }
  return best;
}

export const RECORD_VERDICTS = ["closer_to_other_species", "genes_disagree", "differs", "mixed", "agrees", "differs_one_sequence", "not_assessed"] as const;
export type RecordVerdict = (typeof RECORD_VERDICTS)[number];

/** The record's verdict from its genes': the first of RECORD_VERDICTS that holds. */
export function recordVerdict(genes: { verdict: GeneVerdict; closer: boolean }[]): RecordVerdict {
  const has = (v: GeneVerdict) => genes.some((g) => g.verdict === v);
  if (genes.some((g) => g.closer)) return "closer_to_other_species";
  if (has("differs") && has("agrees")) return "genes_disagree";
  if (has("differs")) return "differs";
  if (has("mixed")) return "mixed";
  if (has("agrees")) return "agrees";
  if (has("differs_one_sequence")) return "differs_one_sequence";
  return "not_assessed";
}
