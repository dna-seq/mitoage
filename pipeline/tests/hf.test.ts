import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { alignmentRows, card, TABLES } from "../hf";

const DIR = join(import.meta.dir, "..", "..", "public", "data", "alignments");

test("the alignment table holds every row of every committed FASTA file, each as long as its file's columns", () => {
  const manifest = JSON.parse(readFileSync(join(DIR, "alignments.json"), "utf8")) as {
    files: { gene: string; kind: string; sequences: number; columns: number }[];
  };
  const rows = alignmentRows(DIR);
  expect(rows.slug.length).toBe(manifest.files.reduce((a, f) => a + f.sequences, 0));
  const seen = new Map<string, { n: number; lengths: Set<number>; slugs: Set<string> }>();
  rows.slug.forEach((slug, i) => {
    const k = `${rows.gene[i]}|${rows.kind[i]}`;
    const e = seen.get(k) ?? seen.set(k, { n: 0, lengths: new Set(), slugs: new Set() }).get(k)!;
    e.n++;
    e.lengths.add(rows.aligned[i]!.length);
    e.slugs.add(slug);
  });
  for (const f of manifest.files) {
    const e = seen.get(`${f.gene}|${f.kind}`)!;
    expect([f.gene, f.kind, e.n, e.slugs.size, [...e.lengths]]).toEqual([f.gene, f.kind, f.sequences, f.sequences, [f.columns]]);
  }
  const i = rows.slug.findIndex((s, j) => s === "homo-sapiens" && rows.gene[j] === "COX1" && rows.kind[j] === "protein");
  expect(rows.scientificName[i]).toBe("Homo sapiens");
  expect(rows.accession[i]).toMatch(/^NC_\d+\.\d+$/);
});

test("a file that disagrees with its manifest, or a header without an accession, stops the packaging", () => {
  const dir = mkdtempSync(join(tmpdir(), "hf-test-"));
  const put = (fasta: string, sequences: number, columns: number) => {
    writeFileSync(join(dir, "G.aa.fasta.gz"), gzipSync(fasta));
    writeFileSync(join(dir, "alignments.json"), JSON.stringify({ files: [{ file: "G.aa.fasta.gz", gene: "G", kind: "protein", sequences, columns }] }));
  };
  put(">a-b A b NC_000001.1\nAC-\n", 1, 3);
  expect(alignmentRows(dir).aligned).toEqual(["AC-"]);
  put(">a-b A b NC_000001.1\nAC-\n", 2, 3);
  expect(() => alignmentRows(dir)).toThrow(/manifest says 2/);
  put(">a-b A b NC_000001.1\nAC-\n", 1, 4);
  expect(() => alignmentRows(dir)).toThrow(/manifest says 4/);
  put(">a-b A b\nAC-\n", 1, 3);
  expect(() => alignmentRows(dir)).toThrow(/RefSeq accession/);
});

test("the card names every table once, says the licence is mixed and keeps the two READMEs without their titles", () => {
  const text = card("# Data title\n\nDATA BODY\n", "# Alignments title\n\nALIGN BODY\n", 7);
  for (const t of TABLES) expect(text.split(`data_files: ${t.file}\n`).length).toBe(2);
  expect(text.startsWith("---\n")).toBe(true);
  expect(text).toContain("license: other");
  expect(text).toContain("CC BY-NC 4.0");
  expect(text).toContain("DATA BODY");
  expect(text).toContain("ALIGN BODY");
  expect(text).not.toContain("Data title");
  expect(text).toContain("(7 rows");
});
