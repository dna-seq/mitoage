/**
 * Independent GenBank sequences of one gene of one species (RM25): nucleotide records of the species' taxon that
 * name the gene, are 300 to 3,000 bases long and are not RefSeq. The length bound keeps whole mitochondrial
 * genomes out, so the record under test and the genome it was copied from are not among them. It does not make
 * a sequence independent in every sense: the same laboratory may have deposited both, and a GenBank sequence
 * can itself carry a wrong name. The master record of a genome project is kept out: it names the species and its
 * length field counts contigs, so it passes the length bound, and it holds no sequence.
 *
 * One search and one fetch per species and gene, cached under data/cache/independent with the search's text,
 * its date and the ids, so a rerun compares the same sequences.
 */
import { existsSync } from "node:fs";
import { cachePath, fetchWithRetry, rateLimiter } from "../lib/cache";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "mitoage-data-pipeline";
/** At most this many sequences per species and gene. */
export const MAX_SEQUENCES = 15;

export const SCREEN_GENES = ["COX1", "CYTB"] as const;
export type ScreenGene = (typeof SCREEN_GENES)[number];

const GENE_TERMS: Record<ScreenGene, string> = {
  COX1: [
    "COI[Gene]", "COX1[Gene]", "CO1[Gene]", "COXI[Gene]", "MT-CO1[Gene]",
    '"cytochrome c oxidase subunit I"[Title]', '"cytochrome oxidase subunit I"[Title]',
    '"cytochrome c oxidase subunit 1"[Title]', '"cytochrome oxidase subunit 1"[Title]',
  ].join(" OR "),
  CYTB: ["CYTB[Gene]", "COB[Gene]", "CYB[Gene]", "MT-CYB[Gene]", '"cytochrome b"[Title]'].join(" OR "),
};

export const searchTerm = (speciesTaxid: number, gene: ScreenGene): string =>
  `txid${speciesTaxid}[Organism:exp] AND (${GENE_TERMS[gene]}) AND 300:3000[SLEN] NOT refseq[filter] NOT wgs_master[prop]`;

export interface IndependentSet {
  term: string;
  /** ISO date and time of the search. */
  searched: string;
  /** Records the search matched at NCBI; `sequences` holds the first of them. */
  count: number;
  sequences: { id: string; title: string; sequence: string }[];
}

export function parseFasta(text: string): { id: string; title: string; sequence: string }[] {
  const out: { id: string; title: string; sequence: string }[] = [];
  for (const block of text.split(/^>/m)) {
    if (!block.trim()) continue;
    const nl = block.indexOf("\n");
    const header = (nl < 0 ? block : block.slice(0, nl)).trim();
    const sp = header.indexOf(" ");
    out.push({
      id: sp < 0 ? header : header.slice(0, sp),
      title: sp < 0 ? "" : header.slice(sp + 1),
      sequence: nl < 0 ? "" : block.slice(nl + 1).replace(/\s+/g, "").toUpperCase(),
    });
  }
  return out;
}

export const setPath = (slug: string, gene: ScreenGene) => cachePath("independent", `${slug}.${gene}.json`);

export async function readSet(slug: string, gene: ScreenGene): Promise<IndependentSet | null> {
  const p = setPath(slug, gene);
  return existsSync(p) ? ((await Bun.file(p).json()) as IndependentSet) : null;
}

const limit = rateLimiter(2.5);

/** The cached set, searched and fetched first when it is not there. Throws when NCBI cannot be reached. */
export async function independentSet(slug: string, speciesTaxid: number, gene: ScreenGene): Promise<IndependentSet> {
  const cached = await readSet(slug, gene);
  if (cached) return cached;
  const term = searchTerm(speciesTaxid, gene);
  await limit();
  const search = await fetchWithRetry(`${EUTILS}/esearch.fcgi`, {
    method: "POST",
    body: new URLSearchParams({ db: "nuccore", retmode: "json", retmax: String(MAX_SEQUENCES), tool: TOOL, term }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const found = ((await search.json()) as { esearchresult?: { count?: string; idlist?: string[]; ERROR?: string } }).esearchresult;
  if (!found || found.ERROR || found.count === undefined || !found.idlist) throw new Error(`esearch gave no result for ${slug} ${gene}: ${found?.ERROR ?? "no esearchresult"}`);
  let sequences: IndependentSet["sequences"] = [];
  if (found.idlist.length) {
    await limit();
    const res = await fetchWithRetry(`${EUTILS}/efetch.fcgi`, {
      method: "POST",
      body: new URLSearchParams({ db: "nuccore", rettype: "fasta", retmode: "text", tool: TOOL, id: found.idlist.join(",") }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    sequences = parseFasta(await res.text());
    if (sequences.length !== found.idlist.length) throw new Error(`efetch returned ${sequences.length} of ${found.idlist.length} sequences for ${slug} ${gene}`);
  }
  const set: IndependentSet = { term, searched: new Date().toISOString(), count: Number(found.count), sequences };
  await Bun.write(setPath(slug, gene), JSON.stringify(set));
  return set;
}
