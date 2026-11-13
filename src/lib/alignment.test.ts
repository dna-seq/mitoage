import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  columnProfile,
  GAP,
  groupIndexByByte,
  maybeGunzipText,
  NUCLEOTIDE_GROUPS,
  parseAlignment,
  PROTEIN_GROUPS,
  residueName,
  shownColumns,
} from "./alignment";

const DIR = join(import.meta.dir, "..", "..", "public", "data", "alignments");
interface ManifestFile {
  file: string;
  kind: string;
  sequences: number;
  columns: number;
  occupiedColumns: number;
  invariantColumns: number;
  conserved90Columns: number;
}
const manifest = JSON.parse(readFileSync(join(DIR, "alignments.json"), "utf8")) as { files: ManifestFile[] };
const load = async (file: string) => {
  const buf = readFileSync(join(DIR, file));
  return parseAlignment(await maybeGunzipText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer));
};

describe("the committed alignment files, as the viewer reads them", () => {
  // The viewer shows the protein and rRNA files; the smallest and one rRNA keep the test quick.
  for (const name of ["ATP8.aa.fasta.gz", "COX1.aa.fasta.gz", "rRNA-12S.nt.fasta.gz"]) {
    test(`${name}: rows, columns and column statistics agree with the manifest`, async () => {
      const m = manifest.files.find((f) => f.file === name)!;
      const a = await load(name);
      expect(a.rows.length).toBe(m.sequences);
      expect(a.columns).toBe(m.columns);
      const p = columnProfile(a.rows, a.columns);
      let occupied = 0;
      let invariant = 0;
      let conserved90 = 0;
      for (let c = 0; c < a.columns; c++) {
        if (p.occupancy[c]! < 0.5) continue;
        occupied++;
        if (p.conservation[c] === 1) invariant++;
        if (p.conservation[c]! >= 0.9) conserved90++;
      }
      // The manifest's numbers come from the pipeline's own count over strings.
      expect({ occupied, invariant, conserved90 }).toEqual({
        occupied: m.occupiedColumns,
        invariant: m.invariantColumns,
        conserved90: m.conserved90Columns,
      });
      expect(shownColumns(p.occupancy, true).length).toBe(m.occupiedColumns);
      expect(shownColumns(p.occupancy, false).length).toBe(m.columns);
    });
  }

  test("a header gives the slug, the scientific name and the accession", async () => {
    const a = await load("ATP8.aa.fasta.gz");
    const human = a.rows.find((r) => r.slug === "homo-sapiens")!;
    expect(human.name).toBe("Homo sapiens");
    expect(human.accession).toMatch(/^NC_\d+\.\d+$/);
    expect(new Set(a.rows.map((r) => r.slug)).size).toBe(a.rows.length);
    for (const r of a.rows) expect(r.name.length).toBeGreaterThan(0);
  });
});

describe("parseAlignment", () => {
  test("wrapped lines, lower case and CRLF", () => {
    const a = parseAlignment(">a-b A b X1\r\nac-\r\ngt\r\n>c-d C d subsp. e X2\nACGGT\n");
    expect(a.columns).toBe(5);
    expect(a.rows.map((r) => [r.slug, r.name, r.accession])).toEqual([
      ["a-b", "A b", "X1"],
      ["c-d", "C d subsp. e", "X2"],
    ]);
    expect(String.fromCharCode(...a.rows[0]!.seq)).toBe("AC-GT");
  });
  test("refuses rows of different lengths, and a file without sequences", () => {
    expect(() => parseAlignment(">a A a X\nAC\n>b B b Y\nACG\n")).toThrow(/not an alignment/);
    expect(() => parseAlignment("")).toThrow(/no sequences/);
    expect(() => parseAlignment("ACGT\n")).toThrow(/no sequences/);
  });
});

describe("columnProfile", () => {
  const a = parseAlignment(">r1 A a X\nAA-C\n>r2 B b Y\nAT-C\n>r3 C c Z\nAT--\n>r4 D d W\nAG--\n");
  const p = columnProfile(a.rows, a.columns);
  test("occupancy, conservation and consensus per column", () => {
    expect([...p.occupancy]).toEqual([1, 1, 0, 0.5]);
    expect([...p.conservation]).toEqual([1, 0.5, 0, 1]);
    expect([...p.consensus].map((b) => (b ? String.fromCharCode(b) : ""))).toEqual(["A", "T", "", "C"]);
  });
  test("a column of gaps only is hidden, a half-filled one is kept", () => {
    expect([...shownColumns(p.occupancy, true)]).toEqual([0, 1, 3]);
    expect([...shownColumns(p.occupancy, false)]).toEqual([0, 1, 2, 3]);
  });
  test("no rows: every column is empty", () => {
    const e = columnProfile([], 3);
    expect([...e.occupancy]).toEqual([0, 0, 0]);
    expect(shownColumns(e.occupancy, true).length).toBe(0);
  });
});

describe("residue groups", () => {
  test("each of the 20 amino acids is in exactly one group", () => {
    const letters = PROTEIN_GROUPS.map((g) => g.letters).join("");
    expect([...letters].sort().join("")).toBe("ACDEFGHIKLMNPQRSTVWY");
    const idx = groupIndexByByte("protein");
    for (const ch of letters) expect(idx[ch.charCodeAt(0)]).toBe(PROTEIN_GROUPS.findIndex((g) => g.letters.includes(ch)));
    expect(idx[GAP]).toBe(-1);
    expect(idx["X".charCodeAt(0)]).toBe(-1);
  });
  test("nucleotides: U is drawn as T, N has no group", () => {
    const idx = groupIndexByByte("rRNA");
    expect(idx["U".charCodeAt(0)]).toBe(NUCLEOTIDE_GROUPS.findIndex((g) => g.key === "t"));
    expect(idx["N".charCodeAt(0)]).toBe(-1);
  });
  test("a cell in words", () => {
    expect(residueName(GAP, "protein")).toBe("gap");
    expect(residueName("L".charCodeAt(0), "protein")).toBe("L, leucine");
    expect(residueName("G".charCodeAt(0), "rRNA")).toBe("G");
  });
});

test("maybeGunzipText leaves plain text alone", async () => {
  const bytes = new TextEncoder().encode(">a A a X\nAC\n");
  expect(await maybeGunzipText(bytes.buffer as ArrayBuffer)).toBe(">a A a X\nAC\n");
});
