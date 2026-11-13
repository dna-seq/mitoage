/**
 * Package the committed build for Hugging Face as a dataset: `bun run hf` writes out/hf/, which is
 * then uploaded by hand (`hf upload ORG/NAME out/hf . --repo-type dataset`). Nothing here talks
 * to Hugging Face.
 *
 * The folder holds public/data/ as it is, one file more and a card:
 *  - alignments/alignments.parquet: every row of every aligned FASTA as one table (gene, kind,
 *    slug, scientific name, accession, aligned sequence), so the dataset viewer and `load_dataset`
 *    read the alignments. It is made here from the committed FASTA files and is not in git (22 MB).
 *  - README.md: the dataset card. Its text is public/data/README.md and the alignments' README,
 *    under a header that names the licence (mixed) and the tables the viewer shows.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { parseFasta } from "./lib/align";
import { readParquet, writeParquet } from "./lib/parquet";

const ROOT = join(import.meta.dir, "..");
const DATA = join(ROOT, "public", "data");
const OUT = join(ROOT, "out", "hf");

interface ManifestFile {
  file: string;
  gene: string;
  kind: string;
  sequences: number;
  columns: number;
}

/** The viewer's tables: config name and file, in the order shown. */
export const TABLES: readonly { name: string; file: string }[] = [
  { name: "species", file: "species.parquet" },
  { name: "region_stats", file: "region_stats.parquet" },
  { name: "codon_usage", file: "codon_usage.parquet" },
  { name: "genome_features", file: "genome_features.parquet" },
  { name: "lifespan_observations", file: "lifespan_observations.parquet" },
  { name: "changelog", file: "changelog.parquet" },
  { name: "alignments", file: "alignments/alignments.parquet" },
];

export interface AlignmentRows {
  gene: string[];
  kind: string[];
  slug: string[];
  scientificName: string[];
  accession: string[];
  aligned: string[];
}

/** Every row of the aligned FASTA files the manifest lists, in the manifest's order. */
export function alignmentRows(dir: string): AlignmentRows {
  const manifest = JSON.parse(readFileSync(join(dir, "alignments.json"), "utf8")) as { files: ManifestFile[] };
  const out: AlignmentRows = { gene: [], kind: [], slug: [], scientificName: [], accession: [], aligned: [] };
  for (const f of manifest.files) {
    const recs = parseFasta(gunzipSync(readFileSync(join(dir, f.file))).toString());
    if (recs.length !== f.sequences) throw new Error(`${f.file}: ${recs.length} sequences, the manifest says ${f.sequences}`);
    for (const r of recs) {
      if (r.seq.length !== f.columns) throw new Error(`${f.file}, ${r.id}: ${r.seq.length} columns, the manifest says ${f.columns}`);
      const words = r.desc.split(/\s+/);
      const accession = words.pop() ?? "";
      if (!/^[A-Z]{2}_\d+\.\d+$/.test(accession)) throw new Error(`${f.file}, ${r.id}: the header does not end with a RefSeq accession: "${r.desc}"`);
      out.gene.push(f.gene);
      out.kind.push(f.kind);
      out.slug.push(r.id);
      out.scientificName.push(words.join(" "));
      out.accession.push(accession);
      out.aligned.push(r.seq);
    }
  }
  return out;
}

export function card(dataReadme: string, alignmentsReadme: string, alignmentRowCount: number): string {
  const body = (text: string): string => text.replace(/^# .*\n+/, "");
  return `---
pretty_name: MitoAge
license: other
license_name: mixed
license_details: >-
  Mixed. Lifespan values taken from FishBase and SeaLifeBase are CC BY-NC 4.0 (non-commercial use only);
  each species row names its licence in lifespan_license. The other sources set their own terms,
  listed under Sources below.
tags:
  - biology
  - genomics
  - mitochondria
  - longevity
  - aging
  - comparative-genomics
size_categories:
  - 10K<n<100K
configs:
${TABLES.map((t, i) => `  - config_name: ${t.name}\n    data_files: ${t.file}${i === 0 ? "\n    default: true" : ""}`).join("\n")}
---

# MitoAge

Mitochondrial DNA of animals against their maximum lifespan: for each species its mitochondrial genome's
base composition, codon usage and annotation, its life-history traits, and the alignments of its
mitochondrial genes with those of every other species. This is the data behind the MitoAge site,
https://just-dna.life/mitoage/, built by the pipeline in https://github.com/dna-seq/mitoage; the files are
the site's downloads, unchanged, plus \`alignments/alignments.parquet\`.

**Licence: mixed, part of it non-commercial.** Lifespan values whose \`lifespan_source\` is \`FishBase\` or
\`SeaLifeBase\` are CC BY-NC 4.0. Every row of \`species\` carries its \`lifespan_license\`; filter on it for
a set free of that limit. The terms of each source are under "Sources".

In Python the tables read with polars, and the FASTA files with polars-bio (checked with polars-bio on
\`ATP8.aa.fasta.gz\`: columns \`name\`, the slug; \`description\`; \`sequence\`):

\`\`\`python
import polars as pl
import polars_bio as pb

base = "hf://datasets/longevity-genie/mitoage/"
species = pl.read_parquet(base + "species.parquet")
alignments = pl.read_parquet(base + "alignments/alignments.parquet")
cox1 = alignments.filter((pl.col("gene") == "COX1") & (pl.col("kind") == "protein")).join(species, on="slug")

# one downloaded FASTA file, as a table
atp8 = pb.read_fasta("ATP8.aa.fasta.gz")
\`\`\`

\`\`\`sql
-- DuckDB: COX1 of the mammals, aligned, with lifespan
SELECT s.scientific_name, s.max_longevity_years, a.aligned
FROM 'hf://datasets/longevity-genie/mitoage/alignments/alignments.parquet' a
JOIN 'hf://datasets/longevity-genie/mitoage/species.parquet' s USING (slug)
WHERE a.gene = 'COX1' AND a.kind = 'protein' AND s.class = 'Mammalia';
\`\`\`

Cite: Toren D, Barzilay T, Tacutu R, Lehmann G, Muradian KK, Fraifeld VE. MitoAge: a database for
comparative analysis of mitochondrial DNA, with a special focus on animal longevity. Nucleic Acids Res.
2016;44(D1):D1262-D1265. doi:10.1093/nar/gkv1187, and the sources of the values you use.

${body(dataReadme).trim()}

## Alignments (alignments/)

\`alignments/alignments.parquet\` (${alignmentRowCount} rows, one per species, gene and kind): \`gene\`, \`kind\`
(\`protein\`: amino acids; \`codon\`: the codon alignment the protein alignment implies; \`rRNA\`: nucleotides),
\`slug\` (joins to \`species.slug\`), \`scientific_name\`, \`accession\` (the RefSeq record), \`aligned\` (the row,
gaps as \`-\`; every row of one gene and kind has the same length). The same rows are in the FASTA files:

${body(alignmentsReadme).trim()}
`;
}

if (import.meta.main) {
  if (!existsSync(join(DATA, "species.parquet"))) throw new Error("public/data/species.parquet is missing: nothing to package");
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(DATA, OUT, { recursive: true });
  const rows = alignmentRows(join(DATA, "alignments"));
  const bytes = await writeParquet(join(OUT, "alignments", "alignments.parquet"), [
    { name: "gene", type: "STRING", data: rows.gene },
    { name: "kind", type: "STRING", data: rows.kind },
    { name: "slug", type: "STRING", data: rows.slug },
    { name: "scientific_name", type: "STRING", data: rows.scientificName },
    { name: "accession", type: "STRING", data: rows.accession },
    { name: "aligned", type: "STRING", data: rows.aligned },
  ]);
  // Read it back: the rows written are the rows read from the FASTA files.
  const back = await readParquet(join(OUT, "alignments", "alignments.parquet"));
  if (back.length !== rows.slug.length) throw new Error(`alignments.parquet: ${back.length} rows read back, ${rows.slug.length} written`);
  back.forEach((r, i) => {
    if (r["slug"] !== rows.slug[i] || r["gene"] !== rows.gene[i] || r["kind"] !== rows.kind[i] || r["aligned"] !== rows.aligned[i]) {
      throw new Error(`alignments.parquet: row ${i} read back differs from the FASTA row`);
    }
  });
  for (const t of TABLES) if (!existsSync(join(OUT, t.file))) throw new Error(`${t.file} is named on the card and is not in the folder`);
  writeFileSync(join(OUT, "README.md"), card(readFileSync(join(DATA, "README.md"), "utf8"), readFileSync(join(DATA, "alignments", "README.md"), "utf8"), rows.slug.length));
  const size = (dir: string): number => readdirSync(dir).reduce((a, n) => { const p = join(dir, n); const s = statSync(p); return a + (s.isDirectory() ? size(p) : s.size); }, 0);
  console.log(`out/hf: alignments.parquet ${rows.slug.length} rows, ${(bytes / 1e6).toFixed(1)} MB; folder ${(size(OUT) / 1e6).toFixed(1)} MB`);
}
