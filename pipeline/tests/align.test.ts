import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { PROTEIN_GENES } from "../../src/data/schema";
import { checkAlignment, degap, formatFasta, parseFasta, summariseColumns, threadCodons } from "../lib/align";
import { ROOT } from "../lib/cache";
import { readParquet } from "../lib/parquet";
import { ALIGNED_GENES, MAFFT_VERSION, codonMismatches } from "../steps/alignments";

describe("FASTA and alignment checks", () => {
  const input = [
    { id: "a", desc: "Species a NC_1.1", seq: "MKTAY" },
    { id: "b", desc: "", seq: "MTAY" },
  ];

  test("FASTA round trip keeps ids, descriptions and sequences, wrapped or not", () => {
    expect(parseFasta(formatFasta(input))).toEqual(input);
    expect(parseFasta(">a Species a NC_1.1\nMK\nTAY\n\n>b\nMTAY")).toEqual(input);
    expect(parseFasta("")).toEqual([]);
    expect(() => parseFasta("MKT\n>a\nMKT")).toThrow();
  });

  test("an alignment is accepted only if it is its input with gaps", () => {
    const ok = [{ ...input[0]!, seq: "MKTAY" }, { ...input[1]!, seq: "M-TAY" }];
    expect(checkAlignment(input, ok)).toBe(5);
    expect(() => checkAlignment(input, [ok[0]!])).toThrow(/rows/);
    expect(() => checkAlignment(input, [ok[1]!, ok[0]!])).toThrow(/expected a/);
    expect(() => checkAlignment(input, [ok[0]!, { ...ok[1]!, seq: "M-TA" }])).toThrow(/columns/);
    expect(() => checkAlignment(input, [ok[0]!, { ...ok[1]!, seq: "M-TAW" }])).toThrow(/not its input/);
    expect(() => checkAlignment([], [])).toThrow(/empty/);
  });

  test("codons follow their residues, gaps become three gaps, the stop codon is left out", () => {
    expect(threadCodons("M-KT", "ATGAAAACC")).toBe("ATG---AAAACC");
    expect(threadCodons("MK", "ATGAAATAA")).toBe("ATGAAA");
    expect(threadCodons("MK", "ATGAAAT")).toBe("ATGAAA");
    expect(() => threadCodons("MKT", "ATGAAA")).toThrow(/too short/);
    expect(() => threadCodons("MK", "ATGAAATAAA")).toThrow(/too long/);
    expect(degap(threadCodons("--M--", "ATG"))).toBe("ATG");
  });

  test("codon rows are checked under the species' genetic code", () => {
    // Vertebrate mitochondrial code (2): TGA is tryptophan, ATA methionine; the standard code would call both wrong.
    expect(codonMismatches("MWM", "ATGTGAATA", 2)).toBe(0);
    expect(codonMismatches("MWK", "ATGTGAATA", 2)).toBe(1);
    // The start codon is not judged; a gap is skipped.
    expect(codonMismatches("M-W", "GTG---TGA", 2)).toBe(0);
  });

  test("column summary counts occupied, invariant and 90 % columns", () => {
    const rows = ["AAAA-", "AAAT-", "AATT-", "A-TTC"].map((seq, i) => ({ id: String(i), desc: "", seq }));
    expect(summariseColumns(rows)).toEqual({ columns: 5, occupied: 4, invariant: 2, conserved90: 2 });
  });
});

const DIR = join(ROOT, "public", "data", "alignments");

describe.skipIf(!existsSync(join(DIR, "alignments.json")))("committed alignments", async () => {
  const manifest = JSON.parse(readFileSync(join(DIR, "alignments.json"), "utf8"));
  const species = await readParquet(join(ROOT, "public", "data", "species.parquet"), ["slug", "record_status", "transl_table"]);
  const live = new Map(species.filter((s) => s["record_status"] !== "retired").map((s) => [String(s["slug"]), Number(s["transl_table"])]));
  const read = (file: string) => gunzipSync(readFileSync(join(DIR, file))).toString("utf8");

  test("the manifest names the pinned aligner and covers every gene", () => {
    expect(manifest.aligner.version).toBe(MAFFT_VERSION);
    expect(manifest.species).toBe(live.size);
    const kinds = new Map<string, string[]>();
    for (const f of manifest.files) kinds.set(f.gene, [...(kinds.get(f.gene) ?? []), f.kind]);
    expect([...kinds.keys()].sort()).toEqual([...ALIGNED_GENES].sort());
    for (const g of PROTEIN_GENES) expect(kinds.get(g)!.sort(), g).toEqual(["codon", "protein"]);
  });

  test("every file is what the manifest says: checksum, rows of one length, live species only, each once", () => {
    for (const f of manifest.files) {
      const text = read(f.file);
      expect(createHash("sha256").update(text).digest("hex"), f.file).toBe(f.sha256);
      const rows = parseFasta(text);
      expect(rows.length, f.file).toBe(f.sequences);
      expect(new Set(rows.map((r) => r.id)).size, f.file).toBe(rows.length);
      for (const r of rows) {
        if (r.seq.length !== f.columns) throw new Error(`${f.file}: ${r.id} has ${r.seq.length} columns, not ${f.columns}`);
        if (!live.has(r.id)) throw new Error(`${f.file}: ${r.id} is not a live species of the build`);
        if (degap(r.seq).length === 0) throw new Error(`${f.file}: ${r.id} is all gaps`);
      }
    }
  });

  test("species counts add up: every live species is aligned, absent with a reason, or noted", () => {
    for (const f of manifest.files) {
      const absent = manifest.absent.filter((a: { gene: string }) => a.gene === f.gene).length;
      const dropped = f.kind === "codon" ? manifest.codonNotes.filter((n: { gene: string; reason: string }) => n.gene === f.gene && n.reason.startsWith("left out")).length : 0;
      expect(f.sequences + absent + dropped, f.file).toBe(live.size);
    }
  });

  test("each codon alignment is its protein alignment, codon for residue", () => {
    for (const gene of PROTEIN_GENES) {
      const protein = new Map(parseFasta(read(`${gene}.aa.fasta.gz`)).map((r) => [r.id, r.seq]));
      let mismatched = 0;
      for (const c of parseFasta(read(`${gene}.codon.fasta.gz`))) {
        const p = protein.get(c.id)!;
        expect(c.seq.length, `${gene} ${c.id}`).toBe(p.length * 3);
        for (let i = 0; i < p.length; i++) {
          const gapP = p[i] === "-";
          const gapC = c.seq.slice(i * 3, i * 3 + 3) === "---";
          if (gapP !== gapC) throw new Error(`${gene} ${c.id}: gap pattern differs at column ${i + 1}`);
        }
        if (codonMismatches(p, c.seq, live.get(c.id)!) > 0) mismatched++;
      }
      const noted = manifest.codonNotes.filter((n: { gene: string; reason: string }) => n.gene === gene && !n.reason.startsWith("left out")).length;
      expect(mismatched, gene).toBe(noted);
    }
  });
});
