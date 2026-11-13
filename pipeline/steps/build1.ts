/**
 * Frozen MitoAge build 1 snapshot: every CSV of the 2015 export converted verbatim to parquet
 * under public/data/build1/. Values are not changed: a column is typed INT32 or DOUBLE only when
 * every non-empty cell round-trips exactly (String(Number(cell)) === cell); otherwise it stays a
 * string. Empty cells become null. The base-label bug is NOT fixed here (see README).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseDelimited } from "../lib/csv";
import { type ColType, type Column, writeParquet } from "../lib/parquet";
import { INPUT_DIR } from "../sources/mitoage";

export const BUILD1_DATE = "2015-07-01T00:00:00.000Z";

export interface Build1File {
  csv: string;
  parquet: string;
  rows: number;
  columns: number;
  csvSha256: string;
  bytes: number;
}

const INT_RE = /^-?\d+$/;

/** Column type that represents every cell losslessly. */
export function losslessType(cells: string[]): ColType {
  const filled = cells.filter((c) => c !== "");
  if (filled.length === 0) return "STRING";
  const exact = filled.every((c) => String(Number(c)) === c);
  if (!exact) return "STRING";
  if (filled.every((c) => INT_RE.test(c) && Math.abs(Number(c)) < 2 ** 31)) return "INT32";
  return "DOUBLE";
}

export function csvToColumns(text: string): Column[] {
  const rows = parseDelimited(text);
  const header = rows[0] ?? [];
  const body = rows.slice(1);
  for (const [i, r] of body.entries()) {
    if (r.length !== header.length) throw new Error(`build 1 CSV row ${i + 2}: ${r.length} cells, header has ${header.length}`);
  }
  return header.map((name, j) => {
    const cells = body.map((r) => r[j]!);
    const type = losslessType(cells);
    return { name, type, data: cells.map((c) => (c === "" ? null : type === "STRING" ? c : Number(c))) };
  });
}

export async function writeBuild1Snapshot(outDir: string): Promise<Build1File[]> {
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(INPUT_DIR).filter((f) => f.endsWith(".csv")).sort();
  if (files.length === 0) throw new Error(`no build 1 CSV files in ${INPUT_DIR}`);
  const out: Build1File[] = [];
  for (const csv of files) {
    const text = await Bun.file(join(INPUT_DIR, csv)).text();
    const cols = csvToColumns(text);
    const parquet = csv.replace(/\.csv$/, ".parquet");
    const bytes = await writeParquet(join(outDir, parquet), cols);
    out.push({
      csv,
      parquet,
      rows: cols[0]?.data.length ?? 0,
      columns: cols.length,
      csvSha256: createHash("sha256").update(text).digest("hex"),
      bytes,
    });
  }
  await Bun.write(join(outDir, "README.md"), build1Readme(out));
  return out;
}

export function build1Readme(files: Build1File[]): string {
  const rows = files.map((f) => `| ${f.parquet} | ${f.rows} | ${f.columns} | \`${f.csvSha256}\` |`).join("\n");
  return `# MitoAge build 1 (frozen snapshot)

The MitoAge build 1 database as released on 2015-07-01 and published in Toren et al. 2016,
Nucleic Acids Res 44(D1):D1262-D1265 (doi:10.1093/nar/gkv1187). Each file is one CSV of the full
database export converted to parquet **verbatim**: the same rows in the same order, the same column
names, the same values. A column is stored as a number only when every cell converts back to exactly
the same text; empty cells are null. This snapshot is immutable: later builds never rewrite it, and
the SHA-256 of each source CSV is listed below so the conversion can be checked.

Known problems are left in place here and corrected in build 2 (see \`../changelog.parquet\`, rows with
\`scope = rule\`):

- The base columns of every \`*_base_composition\` file are complement-labelled: column \`G\` holds the
  number of C on the RefSeq strand, \`C\` holds G, \`A\` holds T and \`T\` holds A. GC% is unaffected; GC
  and AT skews computed from these columns have the wrong sign.
- Features annotated as \`join()\` of segments (for example avian and turtle ND3 with an untranslated
  frameshift nucleotide) were counted over their full start..end span; build 2 counts the annotated
  segments only.
- The export has 923 species; the published release has 922. *Loxioides bailleui* (HAGRID 1598,
  NC_025626.1, 9,243 bp) is not a complete mitogenome and is excluded from every later build.

| file | rows | columns | SHA-256 of the source CSV |
| --- | ---: | ---: | --- |
${rows}
`;
}
