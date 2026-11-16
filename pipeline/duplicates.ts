/**
 * `bun run duplicates`: species of one genus whose 13 mitochondrial protein genes are nearly identical, from the
 * committed build and its codon alignments (public/data/alignments/). Writes
 * docs/analyses/possible-duplicates/NEAR_IDENTICAL.tsv and prints the counts. It reports; nothing is merged
 * or flagged in the build (RM8). Names that are synonyms in a taxonomy are a different rule, which needs
 * the pipeline's raw inputs and is not here.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { getAllSpecies } from "../src/data";
import { nearIdenticalPairs, type DuplicateInput } from "./lib/duplicates";

const ROOT = join(import.meta.dir, "..");
const ALIGNMENTS = join(ROOT, "public", "data", "alignments");
const OUT_DIR = join(ROOT, "docs", "analyses", "possible-duplicates");
/** At or above this share of identical bases a pair is listed. */
export const MIN_IDENTITY = 0.999;
/** A pair sharing fewer aligned bases than this is not judged. */
export const MIN_SITES = 3000;

export function readFasta(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let id = "";
  for (const line of text.split("\n")) {
    if (line.startsWith(">")) {
      id = line.slice(1).split(/\s/)[0]!;
      if (out.has(id)) throw new Error(`sequence ${id} appears twice`);
      out.set(id, "");
    } else if (id) out.set(id, out.get(id)! + line.trim());
  }
  return out;
}

/** Each species' codon alignments concatenated, genes in name order; a gene the species lacks is all gaps. */
export function concatenated(slugs: string[], dir = ALIGNMENTS): Map<string, string | null> {
  const files = readdirSync(dir).filter((f) => f.endsWith(".codon.fasta.gz")).sort();
  if (files.length === 0) throw new Error(`no codon alignments in ${dir}`);
  const parts = new Map<string, string[]>(slugs.map((s) => [s, []]));
  const seen = new Set<string>();
  for (const f of files) {
    const aln = readFasta(gunzipSync(readFileSync(join(dir, f))).toString("utf8"));
    const width = [...aln.values()][0]!.length;
    for (const s of slugs) {
      const q = aln.get(s);
      if (q !== undefined) seen.add(s);
      parts.get(s)!.push(q ?? "-".repeat(width));
    }
  }
  return new Map(slugs.map((s) => [s, seen.has(s) ? parts.get(s)!.join("") : null]));
}

if (import.meta.main) {
  const live = getAllSpecies().filter((s) => s.retiredReason === null);
  const seq = concatenated(live.map((s) => s.slug));
  const input: DuplicateInput[] = live.map((s) => ({
    slug: s.slug, scientificName: s.scientificName, genus: s.taxonomy.genus, refseq: s.refseq, sequence: seq.get(s.slug) ?? null,
  }));
  const r = nearIdenticalPairs(input, MIN_IDENTITY, MIN_SITES);
  const lines = ["species_a\trefseq_a\tspecies_b\trefseq_b\tshared_bases\tdifferences\tidentity_percent"];
  for (const p of r.pairs) {
    const diff = Math.round(p.sites * (1 - p.identity));
    lines.push([p.a.scientificName, p.a.refseq, p.b.scientificName, p.b.refseq, p.sites, diff, (p.identity * 100).toFixed(3)].join("\t"));
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "NEAR_IDENTICAL.tsv"), lines.join("\n") + "\n");
  console.log(`${live.length} species; ${r.compared} pairs within a genus, ${r.notJudged} not judged (no alignment, or fewer than ${MIN_SITES} shared bases)`);
  console.log(`${r.pairs.length} pairs at or above ${MIN_IDENTITY * 100}% identity -> docs/analyses/possible-duplicates/NEAR_IDENTICAL.tsv`);
}
