/**
 * `bun run screen`: every live record's COX1 and CYTB against independent GenBank sequences of its named species
 * and of the other species of its genus in the build (RM25). It reports; nothing is flagged in the build: a row
 * joins the list of audited records (pipeline/curation/sequence-audit.ts) only after a person read it.
 *
 *   bun run screen fetch                 search and fetch the independent sequences into data/cache/independent
 *                                        (network; about two requests per species and gene)
 *   bun run screen compare K N OUT.tsv   compare the species whose index modulo N is K (no network; refuses when a
 *                                        species' sequences were not fetched)
 *   bun run screen summarize DIR         merge the tables of all shards in DIR into
 *                                        docs/analyses/independent-screen/{SCREEN,COMPARISONS}.tsv
 *
 * The rules and their thresholds are in pipeline/lib/screen.ts, the search in pipeline/sources/independent.ts.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { getAllSpecies } from "../src/data";
import type { Species } from "../src/data/schema";
import { SEQUENCE_AUDIT } from "./curation/sequence-audit";
import { readFasta } from "./duplicates";
import { cleanDna, overlap, overlapEitherStrand } from "./lib/overlap";
import { MIN_SITES, SAME_GENE_MIN, closerSpecies, geneVerdict, recordVerdict, stat, type Stat } from "./lib/screen";
import { SCREEN_GENES, independentSet, readSet, type ScreenGene } from "./sources/independent";

const ROOT = join(import.meta.dir, "..");
const ALIGNMENTS = join(ROOT, "public", "data", "alignments");
const OUT_DIR = join(ROOT, "docs", "analyses", "independent-screen");

/** Live species in slug order: the order the shards are cut from. */
export const liveSpecies = (): Species[] =>
  getAllSpecies().filter((s) => (s.retiredReason ?? null) === null).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

/** Each species' gene as the record has it: its row of the codon alignment without the gaps. */
export function recordGenes(gene: ScreenGene): Map<string, string> {
  const aln = readFasta(gunzipSync(readFileSync(join(ALIGNMENTS, `${gene}.codon.fasta.gz`))).toString("utf8"));
  return new Map([...aln].map(([slug, s]) => [slug, cleanDna(s)]));
}

export interface Comparison {
  slug: string;
  gene: ScreenGene;
  /** The species whose independent sequences were compared; the record's own, or another of its genus. */
  target: string;
  own: boolean;
  /** Sequences fetched for the target, and how many of them could be read against the record's gene. */
  fetched: number;
  comparable: number;
  stat: Stat | null;
  /** The comparable sequence with the highest identity. */
  best: string;
}

/** One record's gene against one species' independent sequences. */
export function compareWith(record: string, sequences: { id: string; sequence: string }[]): { stat: Stat | null; best: string } {
  const ids: number[] = [];
  let best = "";
  let bestIdentity = -1;
  for (const q of sequences) {
    const b = cleanDna(q.sequence);
    let r = overlap(record, b);
    if (r.sites < MIN_SITES || r.identity === null || r.identity < 0.9) r = overlapEitherStrand(record, b);
    if (r.sites < MIN_SITES || r.identity === null || r.identity < SAME_GENE_MIN) continue;
    ids.push(r.identity);
    if (r.identity > bestIdentity) { bestIdentity = r.identity; best = q.id; }
  }
  return { stat: stat(ids), best };
}

const COMPARISON_HEADER = ["slug", "gene", "target", "own", "fetched", "comparable", "median", "max", "min", "best"];
const pct = (v: number) => (v * 100).toFixed(2);

async function fetchAll(): Promise<void> {
  const species = liveSpecies();
  let done = 0;
  let noTaxid = 0;
  const failed: string[] = [];
  for (const s of species) {
    if (s.ncbiSpeciesTaxid == null) { noTaxid++; continue; }
    for (const gene of SCREEN_GENES) {
      try {
        await independentSet(s.slug, s.ncbiSpeciesTaxid, gene);
      } catch (e) {
        failed.push(`${s.slug} ${gene}: ${(e as Error).message}`);
      }
    }
    if (++done % 100 === 0) console.log(`  ${done} of ${species.length} species`);
  }
  console.log(`${species.length} live species, ${noTaxid} without a species taxon id (not searched), ${failed.length} searches failed`);
  for (const f of failed) console.log(`  failed: ${f}`);
  if (failed.length) process.exit(1);
}

async function compareShard(k: number, n: number, out: string): Promise<void> {
  const species = liveSpecies();
  const byGenus = new Map<string, Species[]>();
  for (const s of species) if (s.taxonomy.genus) byGenus.set(s.taxonomy.genus, [...(byGenus.get(s.taxonomy.genus) ?? []), s]);
  const lines = [COMPARISON_HEADER.join("\t")];
  for (const gene of SCREEN_GENES) {
    const genes = recordGenes(gene);
    for (let i = k; i < species.length; i += n) {
      const s = species[i]!;
      const record = genes.get(s.slug);
      if (!record || s.ncbiSpeciesTaxid == null) continue; // said as not assessed by summarize, with the reason
      const targets = [s, ...(byGenus.get(s.taxonomy.genus) ?? []).filter((t) => t.slug !== s.slug && t.ncbiSpeciesTaxid != null && t.ncbiSpeciesTaxid !== s.ncbiSpeciesTaxid)];
      for (const t of targets) {
        const set = await readSet(t.slug, gene);
        if (!set) throw new Error(`the independent sequences of ${t.slug} ${gene} were not fetched: run "bun run screen fetch" first`);
        const c = compareWith(record, set.sequences);
        lines.push([s.slug, gene, t.slug, t.slug === s.slug ? "yes" : "no", set.sequences.length, c.stat?.n ?? 0, c.stat ? pct(c.stat.median) : "", c.stat ? pct(c.stat.max) : "", c.stat ? pct(c.stat.min) : "", c.best].join("\t"));
      }
    }
    console.log(`shard ${k} of ${n}: ${gene} done`);
  }
  writeFileSync(out, lines.join("\n") + "\n");
}

export function readComparisons(text: string): Comparison[] {
  const rows = text.split("\n").filter((l) => l.length > 0);
  if (rows[0] !== COMPARISON_HEADER.join("\t")) throw new Error("not a comparisons table: unexpected header");
  return rows.slice(1).map((l) => {
    const c = l.split("\t");
    if (c.length !== COMPARISON_HEADER.length) throw new Error(`row with ${c.length} cells: ${l}`);
    const n = Number(c[5]);
    return {
      slug: c[0]!, gene: c[1] as ScreenGene, target: c[2]!, own: c[3] === "yes", fetched: Number(c[4]), comparable: n,
      stat: n ? { n, median: Number(c[6]) / 100, max: Number(c[7]) / 100, min: Number(c[8]) / 100 } : null, best: c[9]!,
    };
  });
}

function summarize(dir: string): void {
  const species = liveSpecies();
  const files = readdirSync(dir).filter((f) => f.endsWith(".tsv")).sort();
  if (files.length === 0) throw new Error(`no shard tables in ${dir}`);
  const all = files.flatMap((f) => readComparisons(readFileSync(join(dir, f), "utf8")));
  const key = (slug: string, gene: string) => `${slug}\t${gene}`;
  const by = new Map<string, Comparison[]>();
  for (const c of all) by.set(key(c.slug, c.gene), [...(by.get(key(c.slug, c.gene)) ?? []), c]);
  const audit = new Map(SEQUENCE_AUDIT.map((f) => [f.refseq, f.kind]));
  const name = new Map(species.map((s) => [s.slug, s.scientificName]));
  const has = Object.fromEntries(SCREEN_GENES.map((g) => [g, recordGenes(g)])) as Record<ScreenGene, Map<string, string>>;

  const header = ["slug", "scientific_name", "refseq", "class", "confidence", "audit_finding", "verdict"];
  for (const g of SCREEN_GENES) header.push(`${g}_verdict`, `${g}_sequences`, `${g}_median`, `${g}_max`, `${g}_min`, `${g}_closer_species`, `${g}_closer_median`, `${g}_closer_sequences`);
  const lines = [header.join("\t")];
  const counts = new Map<string, number>();
  for (const s of species) {
    const cells: (string | number)[] = [];
    const genes: { verdict: ReturnType<typeof geneVerdict>; closer: boolean }[] = [];
    for (const g of SCREEN_GENES) {
      const rows = by.get(key(s.slug, g));
      if (!rows) {
        const why = s.ncbiSpeciesTaxid == null ? "not_assessed (no species taxon id)" : !has[g].has(s.slug) ? "not_assessed (gene not in the alignment)" : null;
        if (why === null) throw new Error(`${s.slug} ${g} is in no shard table of ${dir}: a shard is missing`);
        cells.push(why, "", "", "", "", "", "", "");
        genes.push({ verdict: "not_assessed", closer: false });
        continue;
      }
      const own = rows.find((r) => r.own)!;
      const others = rows.filter((r) => !r.own && r.stat).map((r) => ({ ...r, stat: r.stat! }));
      const closer = closerSpecies(own.stat, others);
      const v = geneVerdict(own.stat);
      genes.push({ verdict: v, closer: closer !== null });
      const note = v === "not_assessed" ? (own.fetched === 0 ? " (no independent sequence)" : " (no sequence could be compared)") : "";
      cells.push(v + note, own.stat?.n ?? 0, own.stat ? pct(own.stat.median) : "", own.stat ? pct(own.stat.max) : "", own.stat ? pct(own.stat.min) : "",
        closer ? name.get(closer.target)! : "", closer ? pct(closer.stat.median) : "", closer ? closer.stat.n : "");
    }
    const verdict = recordVerdict(genes);
    counts.set(verdict, (counts.get(verdict) ?? 0) + 1);
    lines.push([s.slug, s.scientificName, s.refseq, s.taxonomy.class, s.confidence?.level ?? "", audit.get(s.refseq) ?? "", verdict, ...cells].join("\t"));
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "SCREEN.tsv"), lines.join("\n") + "\n");
  const sorted = [...all].sort((a, b) => (key(a.slug, a.gene) + a.target < key(b.slug, b.gene) + b.target ? -1 : 1));
  writeFileSync(join(OUT_DIR, "COMPARISONS.tsv"), [COMPARISON_HEADER.join("\t"), ...sorted.map((c) =>
    [c.slug, c.gene, c.target, c.own ? "yes" : "no", c.fetched, c.comparable, c.stat ? pct(c.stat.median) : "", c.stat ? pct(c.stat.max) : "", c.stat ? pct(c.stat.min) : "", c.best].join("\t"))].join("\n") + "\n");
  console.log(`${species.length} live species from ${files.length} shard tables`);
  for (const [v, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${n}`);
}

if (import.meta.main) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === "fetch") await fetchAll();
  else if (cmd === "compare" && a !== undefined && b !== undefined && c) {
    const k = Number(a);
    const n = Number(b);
    if (!Number.isInteger(k) || !Number.isInteger(n) || n < 1 || k < 0 || k >= n) throw new Error(`shard ${a} of ${b} is not a shard`);
    await compareShard(k, n, c);
  } else if (cmd === "summarize" && a) summarize(a);
  else {
    console.error("usage: bun run screen fetch | compare K N OUT.tsv | summarize DIR");
    process.exit(2);
  }
}
