import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { CACHE_DIR, ROOT } from "../lib/cache";
import { parseGenBank } from "../lib/genbank";
import { applyGenePatches, translatePatch } from "../lib/gene-patch";
import { ANNOTATION_PATCHES, GENE_GAPS } from "../sources/gene-annotation";
import { REFSEQ_RELEASE } from "../sources/pinned";
import { loadRefSeqRelease } from "../sources/refseq-release";
import { collectSequences } from "../steps/alignments";
import { annotateGenome } from "../steps/genome";

describe("translatePatch", () => {
  test("a clean frame reads with the start codon as M and the stop dropped", () => {
    // ATT (Ile, read as the initiator) GCC (Ala) TGA (Trp in table 2) TAA (stop)
    expect(translatePatch("ATTGCCTGATAA", 2, "t")).toBe("MAW");
  });
  test("refuses part codons, an internal stop and a missing stop", () => {
    expect(() => translatePatch("ATTGCCTA", 2, "t")).toThrow("not whole codons");
    expect(() => translatePatch("ATTTAAGCCTAA", 2, "t")).toThrow("stop codon at codon 2");
    expect(() => translatePatch("ATTGCCGCC", 2, "t")).toThrow("no stop codon");
    // AGA is a stop in the vertebrate code, serine in the invertebrate one.
    expect(() => translatePatch("ATTAGAGCCTAA", 2, "t")).toThrow("stop codon at codon 2");
    expect(translatePatch("ATTAGAGCCTAA", 5, "t")).toBe("MSA");
  });
});

/** Global identity of two proteins: matches over the longer length, by Needleman-Wunsch with unit costs. */
function identity(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  let prev = Array.from({ length: m + 1 }, (_, j) => ({ s: -j, id: 0 }));
  for (let i = 1; i <= n; i++) {
    const cur = [{ s: -i, id: 0 }];
    for (let j = 1; j <= m; j++) {
      const same = a[i - 1] === b[j - 1];
      const d = { s: prev[j - 1]!.s + (same ? 1 : -1), id: prev[j - 1]!.id + (same ? 1 : 0) };
      const u = { s: prev[j]!.s - 1, id: prev[j]!.id };
      const l = { s: cur[j - 1]!.s - 1, id: cur[j - 1]!.id };
      cur.push([d, u, l].reduce((x, y) => (y.s > x.s ? y : x)));
    }
    prev = cur;
  }
  return prev[m]!.id / Math.max(n, m);
}

function alignedProtein(gene: string, slug: string): string {
  const fa = gunzipSync(readFileSync(join(ROOT, "public", "data", "alignments", `${gene}.aa.fasta.gz`))).toString();
  const entry = fa.split(">").find((e) => e.startsWith(`${slug} `));
  if (!entry) throw new Error(`${slug} not in ${gene} alignment`);
  return entry.split("\n").slice(1).join("").replace(/[-\s]/g, "");
}

const haveRelease = existsSync(join(CACHE_DIR, REFSEQ_RELEASE.path));

describe.skipIf(!haveRelease)("annotation patches and gene gaps on the pinned RefSeq records", () => {
  const texts = new Map<string, string>();
  beforeAll(async () => {
    const release = await loadRefSeqRelease();
    const want = [...new Set([...ANNOTATION_PATCHES.map((p) => p.accession), ...GENE_GAPS.map((g) => g.accession)])];
    for (const [v, t] of await release.records(want)) texts.set(v, t);
  }, 300_000);

  test("the African grey parrot's ND6 is added where birds carry it, and reads like a parrot ND6", () => {
    const g = annotateGenome(texts.get("NC_027847.1")!, 2);
    expect(g.patched).toEqual(["ND6"]);
    const nd6 = g.features.filter((f) => f.name === "ND6");
    expect(nd6).toHaveLength(1);
    expect([nd6[0]!.start, nd6[0]!.end, nd6[0]!.strand]).toEqual([17376, 17891, -1]);
    // Between tRNA-Pro and tRNA-Glu, as in the avian gene order.
    const before = g.features.filter((f) => f.end < 17376).at(-1)!;
    const after = g.features.find((f) => f.start > 17891)!;
    expect([before.name, after.name]).toEqual(["tRNA-Pro", "tRNA-Glu"]);
    const cds = g.record.features.find((f) => f.key === "CDS" && f.qualifiers["gene"]?.[0] === "ND6")!;
    const protein = cds.qualifiers["translation"]![0]!;
    const amazona = alignedProtein("ND6", "amazona-aestiva");
    expect(Math.abs(protein.length - amazona.length)).toBeLessThanOrEqual(5);
    expect(identity(protein, amazona)).toBeGreaterThan(0.8);
    // An unrelated protein of the same record does not match: the identity above is not an artefact.
    expect(identity(protein, alignedProtein("ATP8", "amazona-aestiva"))).toBeLessThan(0.4);
  });

  test("the alignments read the patched gene too", () => {
    const sp = [{ slug: "psittacus-erithacus", scientificName: "Psittacus erithacus", refseq: "NC_027847.1" }];
    const seqs = collectSequences(sp as never, texts);
    expect(seqs.protein.get("ND6")!.map((s) => s.id)).toEqual(["psittacus-erithacus"]);
    expect(seqs.absent.filter((a) => a.gene === "ND6")).toEqual([]);
    const cds = seqs.cds.get("ND6")!.get("psittacus-erithacus")!;
    expect(cds.length).toBe(17891 - 17376 + 1);
  });

  test("a patch is refused when the record annotates the gene, or the frame is wrong", () => {
    const text = texts.get("NC_027847.1")!;
    const p = ANNOTATION_PATCHES[0]!;
    expect(() => applyGenePatches(parseGenBank(text), 2, [{ ...p, gene: "ND5" }])).toThrow("now annotates ND5");
    expect(() => applyGenePatches(parseGenBank(text), 2, [{ ...p, location: "complement(17377..17892)" }])).toThrow(/stop codon|no stop/);
    expect(() => applyGenePatches(parseGenBank(text), 2, [{ ...p, location: "complement(17376..99999)" }])).toThrow("outside");
    expect(applyGenePatches(parseGenBank(text), 2, [{ ...p, accession: "NC_000000.1" }])).toEqual([]);
  });

  test("every recorded gap is still a gap in its record", () => {
    for (const gap of GENE_GAPS) {
      const g = annotateGenome(texts.get(gap.accession)!, 2);
      expect(g.features.some((f) => f.name === gap.gene)).toBe(false);
      const others = g.features.filter((f) => f.type === "CDS").length;
      expect(others).toBeGreaterThanOrEqual(11);
      if (gap.reason === "frameshifted_in_record") {
        // The record keeps the gene as a misc_feature, not as a CDS.
        expect(g.record.features.some((f) => f.key === "misc_feature" && /frameshift|similar to/i.test(f.qualifiers["note"]?.join(" ") ?? ""))).toBe(true);
      }
    }
  });
});
