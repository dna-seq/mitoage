/**
 * The confidence level of a species' record (RM25): its levels, the reasons that give one, and the words the
 * site and the downloads use for them. The rules that assign a level are in pipeline/steps/confidence.ts.
 * Safe for islands.
 */
import { CONFIDENCE_LEVELS, type ConfidenceLevel } from "~/data/schema";

export { CONFIDENCE_LEVELS, type ConfidenceLevel };

/** Each reason's level and what it means. */
export const CONFIDENCE_REASONS: Record<string, { level: Exclude<ConfidenceLevel, "high">; text: string }> = {
  retired: { level: "unreliable", text: "the record is retired" },
  sequence_other_species: { level: "unreliable", text: "the record's protein genes are another species'" },
  sequence_chimera: { level: "unreliable", text: "the record joins genes of two unrelated species" },
  sequence_one_genome_names: { level: "unreliable", text: "distinct species carry this same genome, and which name is right is not settled" },
  sequence_truncated: { level: "unreliable", text: "the record is not a complete genome" },
  record_other_species: { level: "unreliable", text: "the cited record now belongs to another species at NCBI" },
  reverse_complement: { level: "unreliable", text: "the record is deposited as the reverse complement, so strand-dependent values (skews) have the opposite sign" },
  no_rrna: { level: "unreliable", text: "no rRNA gene is annotated in the record" },
  lifespan_estimated: { level: "low", text: "the lifespan is an estimate from a growth study, not an observed age" },
  lifespan_low_quality: { level: "low", text: "the source rates the lifespan record low" },
  lifespan_questionable: { level: "low", text: "the source rates the lifespan record questionable" },
  lifespan_ungraded: { level: "low", text: "the lifespan record has no source and no quality" },
  subspecies_record: { level: "caveat", text: "the genome is a subspecies' or a form's record standing for the species" },
  sequence_errors: { level: "caveat", text: "sequencing errors or nuclear copies are reported for the record, or genes do not translate as annotated" },
  specimen_doubt: { level: "caveat", text: "the record's qualifiers name another species' breed or form" },
  ringing_record: { level: "caveat", text: "the lifespan is a ringing recovery, a minimum age in the wild" },
  other_source_higher: { level: "caveat", text: "another source reports a lifespan at least 1.5 times higher" },
  tiny_sample: { level: "caveat", text: "the lifespan rests on a tiny sample" },
  ambiguous_bases: { level: "caveat", text: "the genome has 50 or more ambiguous bases" },
  possible_duplicate: { level: "caveat", text: "the species may be the same as another in the database" },
  source_match_in_review: { level: "caveat", text: "the match of the lifespan record to this species is under review" },
  gene_missing: { level: "caveat", text: "a protein gene is missing from the record's annotation" },
};

/** What no rule looks at; said wherever "high" is shown, so it is not read as "checked in every respect". */
export const NOT_CHECKED = [
  "names against authorities other than NCBI",
  "sequence identity to other species, beyond the records listed in pipeline/curation/sequence-audit.ts",
  "internal stop codons and nuclear copies",
  "the lifespan value against its primary reference",
];

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = { high: "High", caveat: "Caveat", low: "Weak lifespan", unreliable: "Unreliable" };

export const CONFIDENCE_MEANING: Record<ConfidenceLevel, string> = {
  high: "No check found a problem. Not every aspect is checked.",
  caveat: "Usable, with a caveat.",
  low: "The lifespan value is weak; the mitochondrial data are not in question.",
  unreliable: "The record is retired, or its sequence is not this species' genome as it stands.",
};

/** The levels a list or a plot shows unless the visitor asks for more: all but the lowest. */
export const DEFAULT_SHOWN_LEVELS: readonly ConfidenceLevel[] = CONFIDENCE_LEVELS.filter((l) => l !== "unreliable");

/** A reason code ("kind" or "kind:detail") as words; an unknown code is shown as written, never dropped. */
export function confidenceReasonText(code: string): string {
  const kind = code.split(":")[0]!;
  return CONFIDENCE_REASONS[kind]?.text ?? code.replace(/_/g, " ");
}

/**
 * The rows whose level is among `shown`. A row with no level (data built before the level existed) is kept:
 * unknown is not read as unreliable.
 */
export function rowsAtLevels<T>(rows: readonly T[], levelOf: (row: T) => unknown, shown: ReadonlySet<ConfidenceLevel>): T[] {
  return rows.filter((r) => {
    const l = levelOf(r);
    return !(CONFIDENCE_LEVELS as readonly unknown[]).includes(l) || shown.has(l as ConfidenceLevel);
  });
}
