/** Names of mitochondrial regions. Safe for islands. */
import type { Region } from "~/data/schema";

export const REGION_INFO: Record<Region, { name: string; kind: string }> = {
  ND1: { name: "NADH dehydrogenase subunit 1", kind: "Protein-coding gene" },
  ND2: { name: "NADH dehydrogenase subunit 2", kind: "Protein-coding gene" },
  COX1: { name: "Cytochrome c oxidase subunit I", kind: "Protein-coding gene" },
  COX2: { name: "Cytochrome c oxidase subunit II", kind: "Protein-coding gene" },
  ATP8: { name: "ATP synthase F0 subunit 8", kind: "Protein-coding gene" },
  ATP6: { name: "ATP synthase F0 subunit 6", kind: "Protein-coding gene" },
  COX3: { name: "Cytochrome c oxidase subunit III", kind: "Protein-coding gene" },
  ND3: { name: "NADH dehydrogenase subunit 3", kind: "Protein-coding gene" },
  ND4L: { name: "NADH dehydrogenase subunit 4L", kind: "Protein-coding gene" },
  ND4: { name: "NADH dehydrogenase subunit 4", kind: "Protein-coding gene" },
  ND5: { name: "NADH dehydrogenase subunit 5", kind: "Protein-coding gene" },
  ND6: { name: "NADH dehydrogenase subunit 6", kind: "Protein-coding gene" },
  CYTB: { name: "Cytochrome b", kind: "Protein-coding gene" },
  total_mtDNA: { name: "Whole mitochondrial genome", kind: "Whole genome" },
  total_pc: { name: "All protein-coding genes", kind: "Gene set" },
  total_rRNA: { name: "All rRNA genes", kind: "Gene set" },
  total_tRNA: { name: "All tRNA genes", kind: "Gene set" },
  "rRNA-12S": { name: "12S ribosomal RNA", kind: "rRNA gene" },
  "rRNA-16S": { name: "16S ribosomal RNA", kind: "rRNA gene" },
  D_Loop: { name: "Control region (D-loop)", kind: "Non-coding region" },
};

/** Short display label: "ND1", "12S rRNA", "D-loop", "Whole genome". */
export const regionLabel = (r: Region | string): string => {
  switch (r) {
    case "total_mtDNA":
      return "Whole genome";
    case "total_pc":
      return "Protein-coding";
    case "total_rRNA":
      return "All rRNA";
    case "total_tRNA":
      return "All tRNA";
    case "rRNA-12S":
      return "12S rRNA";
    case "rRNA-16S":
      return "16S rRNA";
    case "D_Loop":
      return "D-loop";
    default:
      return r;
  }
};

/** Regions that get their own gene page (aggregates excluded). */
export const GENE_PAGE_REGIONS: readonly Region[] = [
  "ND1", "ND2", "COX1", "COX2", "ATP8", "ATP6", "COX3", "ND3", "ND4L", "ND4", "ND5", "ND6", "CYTB",
  "rRNA-12S", "rRNA-16S", "D_Loop",
];
