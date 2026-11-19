/**
 * The confidence level of a species' record (RM25): how far its sequence, its name and its lifespan can be relied
 * on, as one of four levels with the reasons that gave it. No row is removed for its level.
 *
 *   high        none of the reasons below
 *   caveat      usable, with a named caveat
 *   low         the lifespan value is weak (the mitochondrial data are not in question)
 *   unreliable  the record is retired, or its sequence is not this species' genome as it stands
 *
 * A record deposited as the reverse complement is a caveat, not unreliable: build2's genomeRows gives its base
 * counts on the conventional strand.
 *
 * The level is the worst of the reasons'. A reason says what was found; an aspect no rule looks at (see
 * NOT_CHECKED) is not thereby clean, and the downloads' README says so.
 */
import type { GenomeFeature, LifespanObservation, RegionStats, Species } from "../../src/data/schema";
import { CONFIDENCE_LEVELS, PROTEIN_GENES, type ConfidenceLevel } from "../../src/data/schema";
import { CONFIDENCE_REASONS, NOT_CHECKED } from "../../src/lib/confidence";
import type { SequenceFinding, SequenceFindingKind } from "../curation/sequence-audit";

export { CONFIDENCE_LEVELS, type ConfidenceLevel };

export interface Confidence {
  level: ConfidenceLevel;
  /** Reason codes, sorted; empty when the level is high. A code may carry a detail after a colon. */
  reasons: string[];
}

export { CONFIDENCE_REASONS, NOT_CHECKED };

export const OTHER_SOURCE_RATIO = 1.5;
export const AMBIGUOUS_BASES_MIN = 50;
const RINGING = new Set(["EURING", "USGS_BBL"]);
const FINDING_REASON: Record<SequenceFindingKind, string> = {
  other_species: "sequence_other_species",
  chimera: "sequence_chimera",
  one_genome_names: "sequence_one_genome_names",
  truncated: "sequence_truncated",
  sequence_errors: "sequence_errors",
  specimen_doubt: "specimen_doubt",
};

/**
 * A chordate record deposited on the other strand: all 13 protein genes annotated, each on the strand opposite
 * to the usual one (ND6 forward, the other twelve reverse). A rearranged genome with some genes moved is not it.
 */
export function isReverseComplement(features: GenomeFeature[], phylum: string): boolean {
  if (phylum !== "Chordata") return false;
  const cds = features.filter((f) => f.type === "CDS");
  const names = new Set(cds.map((f) => f.name));
  if (!PROTEIN_GENES.every((p) => names.has(p))) return false;
  return cds.every((f) => (f.name === "ND6" ? f.strand === 1 : f.strand === -1));
}

export interface ConfidenceInput {
  species: Species;
  /** The record's features; undefined when the species has no record in this build (retired). */
  features: GenomeFeature[] | undefined;
  /** Count of bases other than A, C, G, T in the whole genome; null when unknown. */
  ambiguousBases: number | null;
  /** Every lifespan value of this species, the chosen one among them. */
  observations: LifespanObservation[];
  /** The audit's findings on this species' record (already matched on accession.version). */
  findings: SequenceFinding[];
}

const worst = (reasons: string[]): ConfidenceLevel => {
  let w = 0;
  for (const r of reasons) w = Math.max(w, CONFIDENCE_LEVELS.indexOf(CONFIDENCE_REASONS[r.split(":")[0]!]!.level));
  return CONFIDENCE_LEVELS[w]!;
};

export function confidenceOf(x: ConfidenceInput): Confidence {
  const s = x.species;
  const reasons = new Set<string>();
  if (s.provenance?.recordStatus === "retired") reasons.add("retired");

  for (const f of x.findings) reasons.add(FINDING_REASON[f.kind]);
  const flags = (s.reviewFlags ?? []).map((f) => f.split(":")[0]!);
  if (flags.includes("cited_record_resolves_to_other_species")) reasons.add("record_other_species");
  if (flags.includes("possible_duplicate_species")) reasons.add("possible_duplicate");
  if (flags.includes("source_match_in_review")) reasons.add("source_match_in_review");
  if (flags.some((f) => f.startsWith("gene_") && f !== "gene_annotated_by_mitoage")) reasons.add("gene_missing");

  if (x.features) {
    if (isReverseComplement(x.features, s.taxonomy.phylum)) reasons.add("reverse_complement");
    if (!x.features.some((f) => f.type === "rRNA")) reasons.add("no_rrna");
  }
  if (x.ambiguousBases !== null && x.ambiguousBases >= AMBIGUOUS_BASES_MIN) reasons.add("ambiguous_bases");
  if (s.ncbiTaxid != null && s.ncbiSpeciesTaxid != null && s.ncbiTaxid !== s.ncbiSpeciesTaxid) reasons.add("subspecies_record");

  const l = s.lifespan;
  if (!l) reasons.add("lifespan_ungraded");
  else {
    if (l.recordType === "estimated") reasons.add("lifespan_estimated");
    if (l.quality === "low") reasons.add("lifespan_low_quality");
    if (l.quality === "questionable") reasons.add("lifespan_questionable");
    if (RINGING.has(l.source)) reasons.add("ringing_record");
    if (l.sampleSize === "tiny") reasons.add("tiny_sample");
    // another source's observed, ungraded-down value well above the chosen one
    const higher = x.observations.some(
      (o) => !o.isChosen && o.source !== l.source && o.recordType !== "estimated" && o.quality !== "low" && o.quality !== "questionable" && o.valueYears >= OTHER_SOURCE_RATIO * s.maxLongevityYears,
    );
    if (higher && s.maxLongevityYears > 0) reasons.add("other_source_higher");
  }
  const list = [...reasons].sort();
  return { level: worst(list), reasons: list };
}

/** The level of every species. `findings` is the whole audit list; `stats` the whole region table. */
export function confidenceOfAll(
  species: Species[],
  features: Map<number, GenomeFeature[]>,
  stats: RegionStats[],
  observations: LifespanObservation[],
  findings: SequenceFinding[],
): Map<number, Confidence> {
  const ambiguous = new Map<number, number>();
  for (const r of stats) if (r.region === "total_mtDNA") ambiguous.set(r.speciesId, r.other);
  const obs = new Map<number, LifespanObservation[]>();
  for (const o of observations) (obs.get(o.speciesId) ?? obs.set(o.speciesId, []).get(o.speciesId)!).push(o);
  const byRecord = new Map<string, SequenceFinding[]>();
  for (const f of findings) (byRecord.get(f.refseq) ?? byRecord.set(f.refseq, []).get(f.refseq)!).push(f);
  const out = new Map<number, Confidence>();
  for (const s of species) {
    out.set(s.id, confidenceOf({
      species: s,
      features: features.get(s.id),
      ambiguousBases: ambiguous.get(s.id) ?? null,
      observations: obs.get(s.id) ?? [],
      findings: byRecord.get(s.refseq) ?? [],
    }));
  }
  return out;
}
