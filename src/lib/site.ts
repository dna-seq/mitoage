/** Site-wide constants: name, citation, sources and navigation. */

export const SITE_NAME = "MitoAge";
export const SITE_TAGLINE = "Mitochondrial DNA and animal longevity";
export const SITE_DESCRIPTION =
  "MitoAge compares the mitochondrial genomes of animal species, from base composition to codon usage, against their maximum lifespan.";

export const CITATION = {
  authors: "Toren D, Barzilay T, Tacutu R, Lehmann G, Muradian KK, Fraifeld VE",
  title:
    "MitoAge: a database for comparative analysis of mitochondrial DNA, with a special focus on animal longevity",
  journal: "Nucleic Acids Res.",
  year: 2016,
  volume: "44(D1)",
  pages: "D1262–5",
  doi: "10.1093/nar/gkv1187",
  pmid: "26590258",
} as const;

export const CITATION_TEXT = `${CITATION.authors}. ${CITATION.title}. ${CITATION.journal} ${CITATION.year};${CITATION.volume}:${CITATION.pages}.`;

export const CITATION_AUTHORS = [
  "Dmitri Toren",
  "Thomer Barzilay",
  "Robi Tacutu",
  "Gilad Lehmann",
  "Khachik K. Muradian",
  "Vadim E. Fraifeld",
] as const;

export const SOURCE_LINKS = [
  { name: "NCBI RefSeq", url: "https://www.ncbi.nlm.nih.gov/refseq/" },
  { name: "AnAge", url: "https://genomics.senescence.info/species/" },
] as const;

export interface NavItem {
  label: string;
  href: string;
  /** Short description, used in the mobile menu. */
  hint: string;
}

/**
 * Primary navigation (root-relative hrefs; Header/Footer pass them through href() for the
 * base path). To add a section, append an item here; Header renders it on
 * desktop and in the mobile menu, and marks it current for any URL under `href`.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Species", href: "/species/", hint: "Every species with its genome stats" },
  { label: "Tree", href: "/tree/", hint: "Browse the taxonomy" },
  { label: "Genes", href: "/genes/", hint: "The 13 protein-coding genes, rRNA and D-loop" },
  { label: "Explore", href: "/explore/", hint: "Plot any feature against lifespan" },
  { label: "Compare", href: "/compare/", hint: "Put species side by side" },
  { label: "Data", href: "/data/", hint: "Download every table" },
  { label: "About", href: "/about/", hint: "Methods, sources and citation" },
];

export const FOOTER_LINKS: readonly { label: string; href: string }[] = [
  { label: "Species", href: "/species/" },
  { label: "Taxonomy tree", href: "/tree/" },
  { label: "Genes", href: "/genes/" },
  { label: "Plot explorer", href: "/explore/" },
  { label: "Compare", href: "/compare/" },
  { label: "Download data", href: "/data/" },
  { label: "Methods and sources", href: "/about/" },
];
