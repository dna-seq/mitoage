import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readFasta } from "../duplicates";
import { cleanDna, overlap, overlapEitherStrand, reverseComplement } from "../lib/overlap";

/** A real gene: the first sequence of the committed COX1 codon alignment, without its gaps. */
const aln = readFasta(gunzipSync(readFileSync(join(import.meta.dir, "..", "..", "public", "data", "alignments", "COX1.codon.fasta.gz"))).toString("utf8"));
const genes = [...aln.values()].map(cleanDna).filter((s) => s.length > 1400 && /^[ACGT]+$/.test(s));
const gene = genes[0]!;
const other = genes[genes.length - 1]!;

/** Replace the base at each position by another base. */
const mutate = (s: string, positions: number[]): string => {
  const next: Record<string, string> = { A: "C", C: "G", G: "T", T: "A" };
  const out = s.split("");
  for (const p of positions) out[p] = next[out[p]!]!;
  return out.join("");
};

describe("overlap", () => {
  test("a fragment of the gene is placed inside it, identical over its whole length", () => {
    const frag = gene.slice(200, 850);
    const r = overlap(gene, frag);
    expect(r).toEqual({ sites: frag.length, same: frag.length, identity: 1, gaps: 0 });
    expect(overlap(frag, gene)).toEqual(r);
  });

  test("a short fragment far from either end is placed where it belongs", () => {
    const frag = gene.slice(900, 1100);
    expect(overlap(gene, frag)).toEqual({ sites: 200, same: 200, identity: 1, gaps: 0 });
    expect(overlap(frag, gene)).toEqual({ sites: 200, same: 200, identity: 1, gaps: 0 });
  });

  test("a sequence that starts before the gene and ends inside it is compared over the shared part only", () => {
    const flank = other.slice(0, 120);
    const r = overlap(gene, flank + gene.slice(0, 500));
    expect(r.same).toBeGreaterThanOrEqual(500);
    expect(r.sites - r.same).toBeLessThanOrEqual(3);
  });

  test("substitutions are counted, each once", () => {
    const frag = gene.slice(100, 900);
    const positions = [50, 51, 200, 333, 640, 790];
    const r = overlap(gene, mutate(frag, positions));
    expect(r.sites).toBe(frag.length);
    expect(r.sites - r.same).toBe(positions.length);
    expect(r.identity).toBeCloseTo(1 - positions.length / frag.length, 12);
  });

  test("a deleted base costs one gap and no mismatch run", () => {
    const frag = gene.slice(100, 900);
    const r = overlap(gene, frag.slice(0, 400) + frag.slice(401));
    expect(r.gaps).toBe(1);
    expect(r.sites).toBe(frag.length - 1);
    expect(r.sites - r.same).toBeLessThanOrEqual(2);
  });

  test("a base that is not A, C, G or T is not a site", () => {
    const frag = gene.slice(100, 400);
    const r = overlap(gene, frag.slice(0, 150) + "N" + frag.slice(151));
    expect(r.sites).toBe(frag.length - 1);
    expect(r.same).toBe(frag.length - 1);
  });

  test("the other strand is found", () => {
    const frag = gene.slice(300, 1000);
    const r = overlapEitherStrand(gene, reverseComplement(frag));
    expect(r.strand).toBe(-1);
    expect(r.same).toBe(frag.length);
    expect(overlapEitherStrand(gene, frag).strand).toBe(1);
  });

  test("two species' genes differ, and the identity equals the one counted on the alignment's columns", () => {
    const ids = [...aln.keys()];
    const a = aln.get(ids[0]!)!;
    const b = [...aln.entries()].find(([, s]) => cleanDna(s) === other)![1];
    let sites = 0;
    let same = 0;
    for (let i = 0; i < a.length; i++) {
      if (!"ACGT".includes(a[i]!.toUpperCase()) || !"ACGT".includes(b[i]!.toUpperCase())) continue;
      sites++;
      if (a[i]!.toUpperCase() === b[i]!.toUpperCase()) same++;
    }
    const r = overlap(gene, other);
    expect(r.identity!).toBeLessThan(0.999);
    // the pairwise alignment may place a few gaps differently from the codon alignment of all species
    expect(Math.abs(r.identity! - same / sites)).toBeLessThan(0.02);
  });

  test("empty input has no identity", () => {
    expect(overlap("", gene).identity).toBeNull();
    expect(cleanDna("ac-gt 12\nNn")).toBe("ACGTNN");
  });
});
