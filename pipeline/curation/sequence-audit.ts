/**
 * RefSeq records an audit found wrong or doubtful by their own sequence (RM25). Each entry is a finding a person
 * read, with its evidence; `bun run data` only applies it. An entry holds for one accession.version: when the
 * species gets another record, the entry no longer applies and the species is graded on the new record.
 *
 * Kinds, and the level they give (pipeline/steps/confidence.ts):
 *   other_species      the record's protein genes are another species' (unreliable)
 *   chimera            genes of two unrelated species in one record (unreliable)
 *   one_genome_names   two or more distinct species carry the same genome and which name is right is not
 *                      settled; every record of the group gets it (unreliable)
 *   truncated          the record is not a complete genome although it stands as one (unreliable)
 *   specimen_doubt     the record's own qualifiers name another species' breed or form (caveat)
 *
 * Source of every entry below: docs/analyses/curation-audit-2026-11-18/ (identity over the 13 protein genes of
 * the committed codon alignments, about 11,300 shared bases, and the records' headers in the pinned release).
 */
export type SequenceFindingKind = "other_species" | "chimera" | "one_genome_names" | "truncated" | "specimen_doubt";

export interface SequenceFinding {
  /** accession.version the finding is about. */
  refseq: string;
  kind: SequenceFindingKind;
  /** What was seen, in words a reader of the downloads can check. */
  evidence: string;
  /** ISO date of the audit that found it. */
  found: string;
}

const A = "2026-11-18";

export const SEQUENCE_AUDIT: SequenceFinding[] = [
  { refseq: "NC_036956.1", kind: "one_genome_names", evidence: "identical over the 13 protein genes to NC_060592.1 (Echis coloratus) and 99.97% to NC_060591.1 (Echis carinatus): one genome under three species' names", found: A },
  { refseq: "NC_060592.1", kind: "one_genome_names", evidence: "identical over the 13 protein genes to NC_036956.1 (Vipera berus) and 99.97% to NC_060591.1 (Echis carinatus): one genome under three species' names", found: A },
  { refseq: "NC_060591.1", kind: "one_genome_names", evidence: "99.97% over the 13 protein genes to NC_036956.1 (Vipera berus) and NC_060592.1 (Echis coloratus): one genome under three species' names", found: A },
  { refseq: "NC_024750.1", kind: "other_species", evidence: "99.96% over the 13 protein genes to NC_009684.1 (Anas platyrhynchos) and 90% to Tadorna ferruginea; the record's breed qualifier names a domestic duck", found: A },
  { refseq: "NC_025665.1", kind: "chimera", evidence: "99 to 100% to Piaractus brachypomus (another order) in 12 of the 13 protein genes, 82% in ND5; 77% to any species of its own order", found: A },
  { refseq: "NC_006516.1", kind: "other_species", evidence: "99.7% over the 13 protein genes to NC_057518.1 (Didelphis marsupialis), another genus", found: A },
  { refseq: "NC_024055.1", kind: "one_genome_names", evidence: "99.8% over the 13 protein genes to NC_072260.1 (Negaprion brevirostris), another genus; this genome sits within Carcharhinus, so the other record is the likelier mislabel", found: A },
  { refseq: "NC_072260.1", kind: "one_genome_names", evidence: "99.8% over the 13 protein genes to NC_024055.1 (Carcharhinus acronotus), another genus; the shared genome sits within Carcharhinus, so this record is the likelier mislabel", found: A },
  { refseq: "NC_030323.1", kind: "one_genome_names", evidence: "99.8% over the 13 protein genes to NC_045222.1 (Arius maculatus), another genus", found: A },
  { refseq: "NC_045222.1", kind: "one_genome_names", evidence: "99.8% over the 13 protein genes to NC_030323.1 (Netuma thalassina), another genus", found: A },
  { refseq: "NC_045369.1", kind: "one_genome_names", evidence: "no difference in 11,280 bases of the 13 protein genes from NC_045368.1 (Agapornis pullarius), a distinct species", found: A },
  { refseq: "NC_045368.1", kind: "one_genome_names", evidence: "no difference in 11,280 bases of the 13 protein genes from NC_045369.1 (Agapornis lilianae), a distinct species", found: A },
  { refseq: "NC_024922.1", kind: "chimera", evidence: "COX2 99.6% and COX1 94.4% to Syrmaticus reevesii (a pheasant); the other protein genes 93 to 98% to Aythya", found: A },
  { refseq: "NC_061386.1", kind: "truncated", evidence: "12,946 bp, no rRNA gene and 18 tRNA genes annotated", found: A },
  { refseq: "NC_009729.1", kind: "truncated", evidence: "14,935 bp, linear, no control region", found: A },
  { refseq: "NC_020020.1", kind: "truncated", evidence: "14,316 bp, ND2 absent from the record", found: A },
  { refseq: "NC_020656.1", kind: "specimen_doubt", evidence: "the record's breed qualifier is \"Urial\", which is Ovis vignei, not Ovis ammon", found: A },
];
