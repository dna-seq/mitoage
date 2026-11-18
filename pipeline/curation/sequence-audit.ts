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
 *   sequence_errors    sequencing errors or nuclear copies reported for the record, or genes that do not
 *                      translate as annotated (caveat)
 *   specimen_doubt     the record's own qualifiers name another species' breed or form (caveat)
 *
 * Source of every entry below: docs/analyses/curation-audit-2026-11-18/. First round: identity over the 13 protein
 * genes of the committed codon alignments (about 11,300 shared bases) and the records' headers in the pinned
 * release. Second round: each record's COX1 and CYTB against independent GenBank sequences of each named species,
 * which settled which record of a near-identical pair carries the wrong name, and published lists of problematic
 * mitogenomes. A record that agrees with independent sequences of its own species is not listed.
 */
export type SequenceFindingKind = "other_species" | "chimera" | "one_genome_names" | "truncated" | "sequence_errors" | "specimen_doubt";

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
const B = "2026-11-19";

export const SEQUENCE_AUDIT: SequenceFinding[] = [
  { refseq: "NC_060592.1", kind: "other_species", evidence: "COX1 99.4% and CYTB 99.6% to independent sequences of Vipera berus, 83% to those of Echis coloratus; identical over the 13 protein genes to NC_036956.1 (Vipera berus)", found: B },
  { refseq: "NC_060591.1", kind: "other_species", evidence: "COX1 99.4% and CYTB 99.6% to independent sequences of Vipera berus, 84% and 81% to those of Echis carinatus; 99.97% over the 13 protein genes to NC_036956.1 (Vipera berus)", found: B },
  { refseq: "NC_024750.1", kind: "other_species", evidence: "99.96% over the 13 protein genes to NC_009684.1 (Anas platyrhynchos) and 90% to Tadorna ferruginea; COX1 99.8% and CYTB 99.9% to independent mallard sequences; the record's paper describes a domestic duck breed; on the list of Sangster & Luksenburg 2021 as mislabelled", found: B },
  { refseq: "NC_025665.1", kind: "chimera", evidence: "99 to 100% to Piaractus brachypomus (another order) in 12 of the 13 protein genes, 82% in ND5; 77% to any species of its own order", found: A },
  { refseq: "NC_006516.1", kind: "other_species", evidence: "99.7% over the 13 protein genes to NC_057518.1 (Didelphis marsupialis), another genus", found: A },
  { refseq: "NC_072260.1", kind: "other_species", evidence: "COX1 99.8% and CYTB 99.9% to independent sequences of Carcharhinus acronotus, 93.3% and 90.7% to those of Negaprion brevirostris", found: B },
  { refseq: "NC_030323.1", kind: "one_genome_names", evidence: "99.8% over the 13 protein genes to NC_045222.1 (Arius maculatus), another genus", found: A },
  { refseq: "NC_045222.1", kind: "one_genome_names", evidence: "99.8% over the 13 protein genes to NC_030323.1 (Netuma thalassina), another genus", found: A },
  { refseq: "NC_045368.1", kind: "other_species", evidence: "89% to independent sequences of Agapornis pullarius; no difference in 11,280 bases from NC_045369.1 (Agapornis lilianae); on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 as mislabelled", found: B },
  { refseq: "NC_024922.1", kind: "chimera", evidence: "COX2 99.6% and COX1 94.4% to Syrmaticus reevesii (a pheasant); the other protein genes 93 to 98% to Aythya; on the list of Sangster & Luksenburg 2021 as a chimera", found: B },
  { refseq: "NC_061386.1", kind: "truncated", evidence: "12,946 bp, no rRNA gene and 18 tRNA genes annotated", found: A },
  { refseq: "NC_009729.1", kind: "truncated", evidence: "14,935 bp, linear, no control region", found: A },
  { refseq: "NC_020020.1", kind: "truncated", evidence: "14,316 bp, ND2 absent from the record", found: A },
  { refseq: "NC_020656.1", kind: "specimen_doubt", evidence: "the record's breed qualifier is \"Urial\", which is Ovis vignei, not Ovis ammon", found: A },
  // second round, 2026-11-19: independent sequences of each named species, and published lists
  { refseq: "NC_004744.1", kind: "other_species", evidence: "COX1 100% and CYTB 99.9% to independent sequences of Lepisosteus platyrhincus; 98.8% and 95.1% to those of its own species", found: B },
  { refseq: "NC_069041.1", kind: "other_species", evidence: "COX1 100% to four independent sequences of Solenocera crassicornis; 85% and 82% (COX1, CYTB) to those of its own species", found: B },
  { refseq: "NC_012775.1", kind: "other_species", evidence: "COX1 99.5% and CYTB 99.0% to independent sequences of Saimiri boliviensis; 97.2% and 96.1% to those of its own species", found: B },
  { refseq: "NC_064163.1", kind: "other_species", evidence: "COX1 99.5% and CYTB 99.6% to independent sequences of Aotus trivirgatus; 94.2% and 93.6% to those of its own species", found: B },
  { refseq: "NC_066918.1", kind: "other_species", evidence: "COX1 100% and CYTB 99.7% to independent sequences of Pomoxis nigromaculatus; 87.9% and 91.8% to those of its own species", found: B },
  { refseq: "NC_027277.1", kind: "other_species", evidence: "COX1 and CYTB 100% to independent sequences of Coregonus clupeaformis; 98.1% and 95.9% to those of its own species", found: B },
  { refseq: "NC_025576.1", kind: "other_species", evidence: "COX1 99.8% and CYTB 99.5% to independent sequences of Coregonus lavaretus; 98.1% and 96.2% to those of its own species", found: B },
  { refseq: "NC_025648.1", kind: "other_species", evidence: "COX1 99.8% and CYTB 99.5% to independent sequences of Coregonus lavaretus; 98.7% and 98.0% to those of its own species", found: B },
  { refseq: "NC_037970.1", kind: "other_species", evidence: "COX1 98.8% and CYTB 99.1% to independent sequences of Raja clavata; 93.6% and 93.2% to those of its own species", found: B },
  { refseq: "NC_012706.1", kind: "other_species", evidence: "CYTB 100% to independent sequences of Bos taurus; 93.6% (median) to those of its own species", found: B },
  { refseq: "NC_023972.1", kind: "other_species", evidence: "COX1 100% and CYTB 99.5% to independent sequences of Nemipterus virgatus; 86% to those of its own species", found: B },
  { refseq: "NC_035806.1", kind: "other_species", evidence: "COX1 99.7% and CYTB 99.6% to independent sequences of Aquila chrysaetos; 93.6% and 92.0% to those of its own species; on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification", found: B },
  { refseq: "NC_041578.1", kind: "other_species", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification", found: B },
  { refseq: "NC_041251.1", kind: "other_species", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification", found: B },
  { refseq: "NC_028162.1", kind: "other_species", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification", found: B },
  { refseq: "NC_026223.1", kind: "other_species", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification", found: B },
  { refseq: "NC_028188.1", kind: "other_species", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification", found: B },
  { refseq: "NC_022150.1", kind: "other_species", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification, with sequencing errors", found: B },
  { refseq: "NC_023969.1", kind: "chimera", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a chimera", found: B },
  { refseq: "NC_035868.1", kind: "chimera", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a chimera", found: B },
  { refseq: "NC_024280.1", kind: "chimera", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a chimera", found: B },
  { refseq: "NC_035877.1", kind: "chimera", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a chimera", found: B },
  { refseq: "NC_022452.1", kind: "sequence_errors", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) for sequencing errors or nuclear copies", found: B },
  { refseq: "NC_028346.1", kind: "sequence_errors", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) for sequencing errors or nuclear copies", found: B },
  { refseq: "NC_044648.1", kind: "sequence_errors", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) for sequencing errors or nuclear copies", found: B },
  { refseq: "NC_033967.1", kind: "sequence_errors", evidence: "on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) for sequencing errors or nuclear copies", found: B },
  { refseq: "NC_046016.1", kind: "other_species", evidence: "published as a misidentified Scoliodon macrorhynchos", found: B },
  { refseq: "NC_003162.1", kind: "other_species", evidence: "published as Saurida macrolepis under this name", found: B },
  { refseq: "NC_022929.1", kind: "other_species", evidence: "published: K2P distance 0.0015 to Hemiculter eigenmanni and 0.054 to newly sequenced H. leucisculus", found: B },
  { refseq: "NC_001947.1", kind: "sequence_errors", evidence: "ND3 and ND4L do not translate as annotated (6 and 8 internal stops); the record annotates RNA editing, and the codon tables of these two genes come from a frame that does not translate", found: B },
];
