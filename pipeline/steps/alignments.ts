/**
 * Multiple sequence alignments of the mitochondrial genes: the 13 proteins (amino acids, and the codon
 * alignment each implies) and the two rRNAs, across the live species of the build.
 *
 * The aligner is MAFFT, an external program (docs/DECISIONS.md D5): its version is pinned, and another
 * version stops the run rather than producing alignments that silently differ.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROTEIN_GENES } from "../../src/data/schema";
import { type Seq, checkAlignment, formatFasta, parseFasta } from "../lib/align";
import { extractFeature, parseGenBank } from "../lib/genbank";
import { geneticCode } from "../lib/genetic-code";
import { normaliseFeature } from "../lib/names";

export const MAFFT_VERSION = "v7.526";
/** FFT-NS-2, MAFFT's progressive method for thousands of sequences, named outright instead of --auto. */
export const MAFFT_ARGS = ["--retree", "2", "--maxiterate", "0", "--quiet"] as const;
export const RRNA_GENES = ["rRNA-12S", "rRNA-16S"] as const;
export const ALIGNED_GENES = [...PROTEIN_GENES, ...RRNA_GENES] as const;

const mafftBin = () => process.env["MAFFT"] ?? "mafft";

/** The version MAFFT reports (it writes it to stderr), e.g. "v7.526". */
export async function mafftVersion(): Promise<string> {
  let proc;
  try {
    proc = Bun.spawn([mafftBin(), "--version"], { stdout: "pipe", stderr: "pipe" });
  } catch {
    throw new Error(`MAFFT not found (${mafftBin()}). Install MAFFT ${MAFFT_VERSION} and put it on the PATH, or set MAFFT to its path.`);
  }
  const text = (await new Response(proc.stderr).text()) + (await new Response(proc.stdout).text());
  await proc.exited;
  const v = /v\d+\.\d+/.exec(text)?.[0];
  if (!v) throw new Error(`could not read MAFFT's version from: ${text.trim()}`);
  return v;
}

export async function requireMafft(): Promise<string> {
  const v = await mafftVersion();
  if (v !== MAFFT_VERSION) throw new Error(`MAFFT ${v} found; the alignments are pinned to ${MAFFT_VERSION}. Use that version, or change the pin on purpose.`);
  return v;
}

/** Align with the pinned method; the result holds the input sequences in their order (checked). */
export async function align(input: readonly Seq[], threads: number): Promise<{ aligned: Seq[]; columns: number }> {
  const dir = mkdtempSync(join(tmpdir(), "mitoage-align-"));
  try {
    const file = join(dir, "in.fasta");
    writeFileSync(file, formatFasta(input));
    const proc = Bun.spawn([mafftBin(), ...MAFFT_ARGS, "--thread", String(threads), file], { stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    if (code !== 0) throw new Error(`MAFFT exited with ${code}: ${err.trim().slice(-400)}`);
    const aligned = parseFasta(out).map((s) => ({ ...s, seq: s.seq.toUpperCase() }));
    const columns = checkAlignment(input, aligned);
    return { aligned, columns };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface SpeciesRef {
  slug: string;
  scientificName: string;
  refseq: string;
  translTable: number;
}

export interface GeneSequences {
  /** Protein sequences by gene, as RefSeq translates them. */
  protein: Map<string, Seq[]>;
  /** Coding sequence of each protein, by gene then slug. */
  cds: Map<string, Map<string, string>>;
  /** rRNA sequences by gene. */
  rrna: Map<string, Seq[]>;
  /** Why a species has no sequence for a gene. */
  absent: { gene: string; slug: string; reason: string }[];
  /** Genes annotated more than once in a record: the first is used. */
  duplicates: { gene: string; slug: string; copies: number }[];
}

/** Per-gene sequences of every species from its GenBank record. `records` maps accession.version to record text. */
export function collectSequences(species: readonly SpeciesRef[], records: ReadonlyMap<string, string>): GeneSequences {
  const out: GeneSequences = { protein: new Map(), cds: new Map(), rrna: new Map(), absent: [], duplicates: [] };
  for (const g of PROTEIN_GENES) {
    out.protein.set(g, []);
    out.cds.set(g, new Map());
  }
  for (const g of RRNA_GENES) out.rrna.set(g, []);
  for (const s of [...species].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))) {
    const text = records.get(s.refseq);
    if (!text) throw new Error(`no GenBank record for ${s.slug} (${s.refseq})`);
    const rec = parseGenBank(text);
    if (!rec.sequence) throw new Error(`record ${s.refseq} of ${s.slug} carries no sequence`);
    const desc = `${s.scientificName} ${s.refseq}`;
    const copies = new Map<string, number>();
    for (const f of rec.features) {
      if (f.key !== "CDS" && f.key !== "rRNA") continue;
      const n = normaliseFeature(f);
      if (!n) continue;
      const seen = copies.get(n.name) ?? 0;
      copies.set(n.name, seen + 1);
      if (seen > 0) continue;
      if (f.key === "CDS" && out.protein.has(n.name)) {
        const tr = f.qualifiers["translation"]?.[0];
        if (!tr) {
          copies.set(n.name, seen);
          continue;
        }
        out.protein.get(n.name)!.push({ id: s.slug, desc, seq: tr.toUpperCase() });
        const start = Number(f.qualifiers["codon_start"]?.[0] ?? "1");
        out.cds.get(n.name)!.set(s.slug, extractFeature(rec.sequence, f.segments).slice(start - 1).toUpperCase());
      } else if (f.key === "rRNA" && out.rrna.has(n.name)) {
        out.rrna.get(n.name)!.push({ id: s.slug, desc, seq: extractFeature(rec.sequence, f.segments).toUpperCase() });
      }
    }
    for (const g of ALIGNED_GENES) {
      const c = copies.get(g) ?? 0;
      if (c === 0) out.absent.push({ gene: g, slug: s.slug, reason: "not annotated in the record" });
      else if (c > 1) out.duplicates.push({ gene: g, slug: s.slug, copies: c });
    }
  }
  return out;
}

/**
 * How many codons of a codon row do not translate to the residue aligned above them, under the
 * species' genetic code. The first codon is skipped (alternative start codons read as methionine), and a
 * codon or residue with an ambiguity code is not counted.
 */
export function codonMismatches(alignedProtein: string, alignedCodons: string, translTable: number): number {
  const code = geneticCode(translTable);
  let bad = 0;
  let first = true;
  for (let i = 0; i < alignedProtein.length; i++) {
    const aa = alignedProtein[i]!;
    if (aa === "-") continue;
    if (first) {
      first = false;
      continue;
    }
    const expect = code[alignedCodons.slice(i * 3, i * 3 + 3).replace(/T/g, "U")];
    if (expect && aa !== "X" && expect !== aa) bad++;
  }
  return bad;
}
