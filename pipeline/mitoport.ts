/**
 * The coevolution tables of mitoage-pipelines on the site (D20). Run with `bun run mitoport`
 * (bun run pipeline/mitoport.ts): fetches each pinned file of the Hugging Face dataset into
 * data/cache/mitoport/<revision>/ (once; later runs read the cache), refuses any file whose SHA-256 is not
 * the pinned one, and writes public/data/mitoport/: one parquet per file, mitoport.json (what was read and
 * from where) and README.md. Needs nothing of `bun run data`'s inputs.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, cachedDownload } from "./lib/cache";
import { readParquet, writeParquet } from "./lib/parquet";
import {
  MITOPORT_CODE,
  MITOPORT_COMPUTED_ON,
  MITOPORT_DATASET,
  MITOPORT_FILES,
  MITOPORT_HYPOTHESES,
  MITOPORT_LICENSE,
  MITOPORT_RETRIEVED,
  MITOPORT_REVISION,
  NUCLEAR_PARTNERS_DATASET,
  NUCLEAR_PARTNERS_REVISION,
  mitoportTreeUrl,
  mitoportUrl,
} from "./sources/mitoport";
import { convert, firstDifference, lifespanNull, parquetName, verifySha256 } from "./steps/mitoport";

const OUT = join(ROOT, "public", "data", "mitoport");

export interface MitoportManifestFile {
  source: string;
  file: string;
  sha256: string;
  rows: number;
  columns: { name: string; type: string }[];
  renamed: Record<string, string>;
  hypothesis: string;
  description: string;
}

export interface MitoportManifest {
  dataset: string;
  revision: string;
  retrieved: string;
  license: string;
  computedOn: { dataset: string; revision: string; species: number; note: string };
  nuclearPartners: { dataset: string; revision: string };
  files: MitoportManifestFile[];
}

if (import.meta.main) {
  const converted = [];
  for (const f of MITOPORT_FILES) {
    const bytes = await cachedDownload(join("mitoport", MITOPORT_REVISION, f.path), mitoportUrl(f.path));
    const sha256 = verifySha256(bytes, f.sha256, f.path);
    const table = convert(f.path, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    converted.push({ f, sha256, table });
  }

  rmSync(OUT, { recursive: true, force: true });
  const files: MitoportManifestFile[] = [];
  for (const { f, sha256, table } of converted) {
    const file = parquetName(f.path);
    const path = join(OUT, file);
    mkdirSync(dirname(path), { recursive: true });
    await writeParquet(path, table.columns);
    const diff = firstDifference(table, await readParquet(path));
    if (diff) throw new Error(`${file}: the parquet does not read back as written (${diff})`);
    files.push({
      source: `output/mitoport/${f.path}`, file, sha256, rows: table.rows,
      columns: table.columns.map((c) => ({ name: c.name, type: c.type })), renamed: table.renamed,
      hypothesis: f.hypothesis, description: f.description,
    });
    console.log(`  ${file}: ${table.rows} rows, ${table.columns.length} columns`);
  }

  const verdict = lifespanNull(await readParquet(join(OUT, "partners.parquet")), await readParquet(join(OUT, "iface", "lifespan.parquet")));
  if (!verdict.holds) {
    throw new Error(`the README would say that no feature here follows lifespan, and the tables do not show it:\n  ${verdict.failures.join("\n  ")}`);
  }

  const manifest: MitoportManifest = {
    dataset: MITOPORT_DATASET, revision: MITOPORT_REVISION, retrieved: MITOPORT_RETRIEVED, license: MITOPORT_LICENSE,
    computedOn: { ...MITOPORT_COMPUTED_ON },
    nuclearPartners: { dataset: NUCLEAR_PARTNERS_DATASET, revision: NUCLEAR_PARTNERS_REVISION },
    files,
  };
  writeFileSync(join(OUT, "mitoport.json"), JSON.stringify(manifest, null, 1) + "\n");
  writeFileSync(join(OUT, "README.md"), readme(manifest));
  console.log(`public/data/mitoport: ${files.length} tables from ${MITOPORT_DATASET} at ${MITOPORT_REVISION.slice(0, 7)}`);
}

export function readme(m: MitoportManifest): string {
  const rows = m.files
    .map((f) => `| \`${f.file}\` | ${f.rows} | ${f.hypothesis} | ${f.description} |`)
    .join("\n");
  const renamed = m.files.flatMap((f) => Object.entries(f.renamed).map(([a, b]) => `\`${f.file}\`: "${a}" is \`${b}\``));
  return `# Coevolution of mitochondrial and nuclear proteins

Tables of the mitoport analyses of mitoage-pipelines (${MITOPORT_CODE}), copied without changing a value
from the Hugging Face dataset \`${m.dataset}\` at revision \`${m.revision}\`
(${mitoportTreeUrl(m.dataset, m.revision, "output/mitoport")}), retrieved ${m.retrieved}. Each file here is
the file of the same path under \`output/mitoport/\` there, as parquet; \`mitoport.json\` gives each source
file's SHA-256, which \`bun run mitoport\` checks before it writes anything.

**Which build.** Not the build the rest of this folder holds: the MitoAge build at Hugging Face revision
\`${m.computedOn.revision.slice(0, 7)}\` of \`${m.computedOn.dataset}\` (${m.computedOn.species.toLocaleString("en-US")} species). ${m.computedOn.note} Species are named by slug, which does not change between builds; alignment
columns (\`aln_col\` in \`iface/contact_map/\`) are columns of that build's alignments, not of
\`alignments/\` here.

**What they are for.** None of these features follows lifespan: mismatch at complex IV's mito-nuclear
contacts (H9) and discordance of its contact pairs (H12) give intervals that include zero in every set and
class tested. The tables are offered for reuse in studies of mito-nuclear coevolution, not as a longevity
signal. What each analysis did and found: ${MITOPORT_HYPOTHESES} (H5, H6, H9, H12).

| File | Rows | Finding | What it holds |
| --- | --- | --- | --- |
${rows}

An empty cell in the source is null here: not assessed (too few species or pairs), never zero.${renamed.length ? ` Column
names with spaces got underscores: ${renamed.join("; ")}.` : ""}

The nuclear ortholog sets and their alignments are in \`${m.nuclearPartners.dataset}\` at revision
\`${m.nuclearPartners.revision}\` (${mitoportTreeUrl(m.nuclearPartners.dataset, m.nuclearPartners.revision)}).

Licence: ${m.license}. Nothing here is peer reviewed.
`;
}
