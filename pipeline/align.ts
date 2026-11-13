/**
 * Alignments of the mitochondrial genes. Run with `bun run align` (bun run pipeline/align.ts), after
 * `bun run data`: it reads the species of the committed build (public/data/species.parquet) and their
 * records in the pinned RefSeq release, and writes public/data/alignments/.
 *
 * Needs MAFFT at the pinned version on the PATH (or MAFFT=/path/to/mafft). MITOAGE_THREADS sets the
 * threads MAFFT may use (default 4).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { PROTEIN_GENES } from "../src/data/schema";
import { type Seq, formatFasta, summariseColumns, threadCodons } from "./lib/align";
import { ROOT } from "./lib/cache";
import { parseGenBank } from "./lib/genbank";
import { readParquet } from "./lib/parquet";
import { fetchGenBank } from "./sources/ncbi";
import { REFSEQ_RELEASE } from "./sources/pinned";
import { loadRefSeqRelease } from "./sources/refseq-release";
import { MAFFT_ARGS, RRNA_GENES, type SpeciesRef, align, codonMismatches, collectSequences, requireMafft } from "./steps/alignments";

const OUT = join(ROOT, "public", "data", "alignments");
const threads = Number(process.env["MITOAGE_THREADS"] ?? "4");

export interface AlignmentFile {
  file: string;
  gene: string;
  kind: "protein" | "codon" | "rRNA";
  sequences: number;
  columns: number;
  occupiedColumns: number;
  invariantColumns: number;
  conserved90Columns: number;
  /** SHA-256 of the uncompressed FASTA. */
  sha256: string;
  bytes: number;
}

const mafft = await requireMafft();
const rows = await readParquet(join(ROOT, "public", "data", "species.parquet"), ["slug", "scientific_name", "refseq", "transl_table", "record_status"]);
const species: SpeciesRef[] = rows
  .filter((r) => r["record_status"] !== "retired")
  .map((r) => ({ slug: String(r["slug"]), scientificName: String(r["scientific_name"]), refseq: String(r["refseq"]), translTable: Number(r["transl_table"]) }));
console.log(`Alignments: ${species.length} live species, MAFFT ${mafft} ${MAFFT_ARGS.join(" ")}, ${threads} threads`);

const release = await loadRefSeqRelease();
const records = await release.records(species.map((s) => s.refseq));
// A few release records carry only a CONTIG line: their sequence comes from efetch of the same version.
const bare = [...records].filter(([, text]) => !parseGenBank(text).sequence).map(([v]) => v);
if (bare.length) {
  const { texts, failed } = await fetchGenBank(bare);
  if (failed.length) throw new Error(`no sequence for ${failed.join(", ")}: the release record has only a CONTIG line and efetch did not return it`);
  for (const v of bare) {
    const got = parseGenBank(texts.get(v)!);
    if (got.accessionVersion !== v || got.sequence.length !== release.byVersion.get(v)!.length) throw new Error(`efetch record for ${v} does not match the release header`);
    records.set(v, texts.get(v)!);
  }
}

const seqs = collectSequences(species, records);
const table = new Map(species.map((s) => [s.slug, s.translTable]));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const files: AlignmentFile[] = [];
const codonNotes: { gene: string; slug: string; reason: string }[] = [];

function write(gene: string, kind: AlignmentFile["kind"], suffix: string, aligned: Seq[]): void {
  const text = formatFasta(aligned);
  const file = `${gene}.${suffix}.fasta.gz`;
  const gz = gzipSync(text, { level: 9 });
  writeFileSync(join(OUT, file), gz);
  const s = summariseColumns(aligned);
  files.push({
    file, gene, kind, sequences: aligned.length, columns: s.columns, occupiedColumns: s.occupied, invariantColumns: s.invariant,
    conserved90Columns: s.conserved90, sha256: createHash("sha256").update(text).digest("hex"), bytes: gz.length,
  });
  console.log(`  ${file}: ${aligned.length} sequences, ${s.columns} columns (${s.occupied} occupied), ${(gz.length / 1024).toFixed(0)} KB`);
}

for (const gene of PROTEIN_GENES) {
  const { aligned } = await align(seqs.protein.get(gene)!, threads);
  write(gene, "protein", "aa", aligned);
  const codons: Seq[] = [];
  for (const row of aligned) {
    const cds = seqs.cds.get(gene)!.get(row.id)!;
    try {
      const seq = threadCodons(row.seq, cds);
      const bad = codonMismatches(row.seq, seq, table.get(row.id)!);
      if (bad > 0) codonNotes.push({ gene, slug: row.id, reason: `${bad} codons do not translate to the aligned residue (RNA editing, a frameshift or an exception in the record)` });
      codons.push({ ...row, seq });
    } catch (e) {
      codonNotes.push({ gene, slug: row.id, reason: `left out of the codon alignment: ${(e as Error).message}` });
    }
  }
  write(gene, "codon", "codon", codons);
}
for (const gene of RRNA_GENES) {
  const { aligned } = await align(seqs.rrna.get(gene)!, threads);
  write(gene, "rRNA", "nt", aligned);
}

const manifest = {
  aligner: { program: "MAFFT", version: mafft, arguments: MAFFT_ARGS.join(" "), method: "FFT-NS-2 (progressive)" },
  source: { name: REFSEQ_RELEASE.name, version: REFSEQ_RELEASE.version, md5: release.md5 },
  species: species.length,
  files,
  absent: seqs.absent,
  duplicates: seqs.duplicates,
  codonNotes,
};
writeFileSync(join(OUT, "alignments.json"), JSON.stringify(manifest, null, 1) + "\n");

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
const readme = `# MitoAge alignments

Multiple sequence alignments of the mitochondrial genes across the ${species.length} live species of the
build (retired species are left out). One gzipped FASTA per gene, one line per species; the first word of
each header is the species' slug, as in every other MitoAge table, followed by its name and RefSeq record.

- \`GENE.aa.fasta.gz\`: the protein, as RefSeq translates it, aligned with ${manifest.aligner.program} ${mafft}
  (\`mafft ${MAFFT_ARGS.join(" ")}\`, the FFT-NS-2 progressive method).
- \`GENE.codon.fasta.gz\`: the codon alignment the protein alignment implies (each residue replaced by its
  codon, each gap by three), without the stop codon.
- \`rRNA-12S.nt.fasta.gz\`, \`rRNA-16S.nt.fasta.gz\`: the rRNA genes, aligned as nucleotides the same way.
- \`alignments.json\`: for every file its number of sequences and columns, how many columns are well
  occupied, invariant or carry one residue in 90 % of species, and its SHA-256; the species a gene is not
  annotated in; genes annotated twice (the first copy is used); and the codon rows that do not translate
  exactly to their protein.

Sequences come from ${REFSEQ_RELEASE.name}, ${REFSEQ_RELEASE.version}. These are sequence alignments made
by one fast method over very distant animals: columns in poorly conserved stretches are not reliable
homology statements. Regenerate with \`bun run align\`.

| File | Sequences | Columns | Occupied | One residue in 90 % | Size |
| --- | ---: | ---: | ---: | ---: | ---: |
${files.map((f) => `| ${f.file} | ${f.sequences} | ${f.columns} | ${f.occupiedColumns} | ${f.conserved90Columns} | ${kb(f.bytes)} |`).join("\n")}
`;
writeFileSync(join(OUT, "README.md"), readme);
const total = readdirSync(OUT).length;
console.log(`Alignments: ${files.length} alignment files (${kb(files.reduce((a, f) => a + f.bytes, 0))}), ${seqs.absent.length} gene absences, ${seqs.duplicates.length} duplicated genes, ${codonNotes.length} codon notes; ${total} files in public/data/alignments`);
