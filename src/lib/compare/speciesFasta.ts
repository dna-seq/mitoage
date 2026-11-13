/**
 * The genomes of the species chosen on the side-by-side view (/compare/species/) as one FASTA
 * download: which accessions to ask NCBI for, in the order shown, and which of the chosen have
 * none. Safe for islands.
 */

/** One chosen species as the view holds it: `refseq` is null when its record has not loaded. */
export interface ChosenSpecies {
  slug: string;
  refseq: string | null;
}

export interface FastaChoice {
  /** Versioned RefSeq accessions, in the order of the chosen species. */
  accessions: string[];
  /** Slugs of the species asked for, in the same order. */
  slugs: string[];
  /** Slugs chosen that have no accession to ask for: not loaded, or loaded without one. */
  leftOut: string[];
}

export function fastaChoice(chosen: readonly ChosenSpecies[]): FastaChoice {
  const out: FastaChoice = { accessions: [], slugs: [], leftOut: [] };
  for (const c of chosen) {
    const acc = c.refseq?.trim() ?? "";
    if (acc) {
      out.accessions.push(acc);
      out.slugs.push(c.slug);
    } else out.leftOut.push(c.slug);
  }
  return out;
}

/** Longest file name that still lists every species. */
export const FASTA_NAME_MAX = 80;

/**
 * File name for the genomes of these species: every slug while the name stays short, otherwise
 * the first and how many follow.
 */
export function compareFastaName(slugs: readonly string[]): string {
  const first = slugs[0];
  if (first === undefined) return "mitoage-species.fasta";
  const all = `mitoage-${slugs.join("-")}.fasta`;
  return slugs.length === 1 || all.length <= FASTA_NAME_MAX ? all : `mitoage-${first}-and-${slugs.length - 1}-more.fasta`;
}

/** What to say about the chosen species that were not asked for, or undefined when there is none. */
export function leftOutSentence(slugs: readonly string[]): string | undefined {
  if (!slugs.length) return undefined;
  const one = slugs.length === 1;
  return `${slugs.join(", ")} ${one ? "has" : "have"} no accession here and ${one ? "was" : "were"} left out.`;
}
