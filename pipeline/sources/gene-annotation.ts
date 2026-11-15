/**
 * Protein genes a record leaves out, and what the build does about each.
 *
 * Two lists, both checked by hand against the record and kept short:
 * - ANNOTATION_PATCHES: a gene that is intact in the record's sequence but not annotated. The build adds it
 *   only to that exact accession.version, and refuses the patch if the record ever annotates the gene itself
 *   or if the patched location does not read as one open reading frame (`pipeline/lib/gene-patch.ts`).
 * - GENE_GAPS and LINEAGE_GENE_GAPS: a gene the build leaves out, with the reason, published as a review flag
 *   on the species. A missing gene with no entry here is flagged as unexplained, never dropped in silence.
 */
import type { ProteinGene } from "../../src/data/schema";

export interface AnnotationPatch {
  accession: string;
  gene: ProteinGene;
  /** GenBank location syntax, in the record's coordinates. */
  location: string;
  /** How the location was found and checked, for the changelog. */
  evidence: string;
}

export const ANNOTATION_PATCHES: readonly AnnotationPatch[] = [
  {
    accession: "NC_027847.1",
    gene: "ND6",
    location: "complement(17376..17891)",
    evidence:
      "Psittacus erithacus: the record annotates no ND6. An open reading frame of 171 codons and a TAA stop on the " +
      "minus strand, between tRNA-Pro (complement(17303..17373)) and tRNA-Glu (complement(17893..17962)), the avian " +
      "position of ND6, translates to a protein matching Amazona aestiva ND6 over its whole length; found by a " +
      "six-frame search with the Amazona protein, 2026-11-15",
  },
];

/**
 * Why a gene is left out:
 * - `absent_from_record`: the gene is not in the record's sequence (a search with a relative's protein finds
 *   nothing), and the record says so or is incomplete;
 * - `frameshifted_in_record`: the record marks the gene as not intact (a misc_feature, not a CDS), and its
 *   sequence reads in two frames;
 * - `not_annotated`: the record has no annotation for it and no search was made;
 * - `lost_in_lineage`: published as absent from the mitogenomes of the lineage.
 */
export type GeneGapReason = "absent_from_record" | "frameshifted_in_record" | "not_annotated" | "lost_in_lineage";

export interface GeneGap {
  accession: string;
  gene: ProteinGene;
  reason: GeneGapReason;
  detail: string;
}

export const GENE_GAPS: readonly GeneGap[] = [
  {
    accession: "NC_004815.1", gene: "ND5", reason: "absent_from_record",
    detail: "Sphenodon punctatus: the record's comment says the genome lacks ND5, tRNA-His and tRNA-Thr (Rest et al. 2003)",
  },
  {
    accession: "NC_010689.1", gene: "ND6", reason: "absent_from_record",
    detail: "Chionodraco myersi: the record says the genome lacks ND6 and tRNA-Glu; in Antarctic notothenioids ND6 moved into the control region (Zhuang & Cheng 2010, doi:10.1093/molbev/msq026), which this record does not carry it in",
  },
  {
    accession: "NC_020020.1", gene: "ND2", reason: "absent_from_record",
    detail: "Homarus gammarus: a provisional record of 14,316 bp that starts inside COX1; ND2 is not in its sequence",
  },
  {
    accession: "NC_033966.1", gene: "CYTB", reason: "frameshifted_in_record",
    detail: "Pluvialis fulva: misc_feature 13637..14774 'nonfunctional CytB due to frameshift'",
  },
  {
    accession: "NC_008140.1", gene: "ND1", reason: "frameshifted_in_record",
    detail: "Podiceps cristatus: misc_feature 2716..3694 'similar to NADH dehydrogenase subunit 1', reading in two frames",
  },
];

/** Gaps that hold for a whole lineage, matched on the species' phylum or class. */
export const LINEAGE_GENE_GAPS: readonly { gene: ProteinGene; rank: "phylum" | "class"; taxon: string; reason: GeneGapReason; detail: string }[] = [
  {
    gene: "ATP8", rank: "phylum", taxon: "Nematoda", reason: "lost_in_lineage",
    detail: "nematode mtDNA has no ATP8 (Okimoto et al. 1992, doi:10.1093/genetics/130.3.471)",
  },
  {
    gene: "ATP8", rank: "class", taxon: "Bivalvia", reason: "not_annotated",
    detail: "many bivalve records annotate no ATP8; whether the gene is lost or an unannotated short reading frame was not checked",
  },
];
