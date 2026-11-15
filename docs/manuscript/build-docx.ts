// Builds a manuscript round's Markdown file into the Word file the manuscript-skills plugin uploads to Google
// Drive as a Google Doc (`rounds.py push`, the project file's `coauthors.build`):
//
//   bun ../build-docx.ts mitoage2.md                              # run from the round folder, e.g. v0.2/
//   bun ../build-docx.ts supplementary/mitoage2.supplementary.md  # writes supplementary/build/<stem>.docx
//
// It writes <dir of the file>/build/<stem>.docx, where rounds.py looks for it. pandoc lays every table out for a
// text width of 7,920 twips (5.5 inches) whatever the reference document says, and Google Docs keeps those column
// widths, so a nine-column table wraps four-digit numbers. After pandoc, each table's grid is scaled to the 6.5-inch
// text width of a Google Doc (letter, 1-inch margins), keeping the proportions the Markdown's separator line gives.
// pandoc is the one on PATH, or the binary named by $PANDOC.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";

const TEXT_WIDTH_TWIPS = 9360;

function run(command: string[], cwd?: string): void {
  const done = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const err = done.stderr.toString();
  if (err.trim()) console.error(err.trim());
  if (done.exitCode !== 0) {
    throw new Error(`${command[0]} exited with ${done.exitCode}`);
  }
}

/** Scale every table grid so its columns add up to the text width, keeping their proportions. */
export function widenTables(documentXml: string, width = TEXT_WIDTH_TWIPS): { xml: string; tables: number } {
  let tables = 0;
  const xml = documentXml.replace(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/g, (_whole, grid: string) => {
    const widths = [...grid.matchAll(/<w:gridCol w:w="(\d+)"\s*\/>/g)].map((m) => Number(m[1]));
    const total = widths.reduce((a, b) => a + b, 0);
    if (widths.length === 0 || total <= 0) return `<w:tblGrid>${grid}</w:tblGrid>`;
    tables += 1;
    const scaled = widths.map((w) => Math.floor((w * width) / total));
    return `<w:tblGrid>${scaled.map((w) => `<w:gridCol w:w="${w}" />`).join("")}</w:tblGrid>`;
  });
  return { xml, tables };
}

function main(): void {
  const file = process.argv[2];
  if (!file || extname(file) !== ".md") {
    console.error("usage: bun ../build-docx.ts <markdown file relative to the round folder>");
    process.exit(2);
  }
  const source = resolve(file);
  const out = join(dirname(source), "build", `${basename(source, ".md")}.docx`);
  mkdirSync(dirname(out), { recursive: true });
  const pandoc = process.env.PANDOC ?? "pandoc";
  run([pandoc, source, "-o", out, `--resource-path=${dirname(source)}:${process.cwd()}`]);

  const work = mkdtempSync(join(tmpdir(), "mitoage-docx-"));
  try {
    run(["unzip", "-q", "-o", out, "word/document.xml", "-d", work]);
    const path = join(work, "word", "document.xml");
    const { xml, tables } = widenTables(readFileSync(path, "utf8"));
    writeFileSync(path, xml);
    run(["zip", "-q", out, "word/document.xml"], work);
    console.log(`wrote ${out}: ${tables} table(s) widened to ${TEXT_WIDTH_TWIPS} twips`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) main();
