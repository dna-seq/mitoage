import { describe, expect, test } from "bun:test";
import { AGREE_MIN, CLOSER_MARGIN, CLOSER_MIN, closerSpecies, geneVerdict, recordVerdict, stat } from "../lib/screen";
import { parseFasta, searchTerm } from "../sources/independent";
import { reverseComplement } from "../lib/overlap";
import { MIN_SITES, SAME_GENE_MIN } from "../lib/screen";
import { compareWith, recordGenes } from "../screen";

describe("stat", () => {
  test("median of odd and even counts, and the extremes", () => {
    expect(stat([])).toBeNull();
    expect(stat([0.9])).toEqual({ n: 1, median: 0.9, max: 0.9, min: 0.9 });
    expect(stat([0.99, 0.9, 0.95])).toEqual({ n: 3, median: 0.95, max: 0.99, min: 0.9 });
    expect(stat([1, 0.9, 0.98, 0.96])!.median).toBeCloseTo(0.97, 12);
  });
});

describe("geneVerdict", () => {
  test("no sequence is not assessed, never an agreement", () => {
    expect(geneVerdict(null)).toBe("not_assessed");
  });
  test("the threshold itself agrees; just below it does not", () => {
    expect(geneVerdict(stat([AGREE_MIN, AGREE_MIN, 1]))).toBe("agrees");
    expect(geneVerdict(stat([AGREE_MIN - 1e-9, AGREE_MIN - 1e-9]))).toBe("differs");
  });
  test("some sequences agree and most do not: mixed", () => {
    expect(geneVerdict(stat([0.99, 0.9, 0.9]))).toBe("mixed");
  });
  test("a single differing sequence is said as one sequence", () => {
    expect(geneVerdict(stat([0.9]))).toBe("differs_one_sequence");
    expect(geneVerdict(stat([0.9, 0.91]))).toBe("differs");
  });
});

describe("closerSpecies", () => {
  const other = (name: string, v: number[]) => ({ name, stat: stat(v)! });
  test("needs the margin and the minimum, both", () => {
    const own = stat([0.95, 0.95])!;
    expect(closerSpecies(own, [other("a", [0.999])])!.name).toBe("a");
    expect(closerSpecies(own, [other("a", [CLOSER_MIN - 0.001])])).toBeNull();
    expect(closerSpecies(stat([0.985])!, [other("a", [0.985 + CLOSER_MARGIN - 0.001])])).toBeNull();
    expect(closerSpecies(stat([0.985])!, [other("a", [0.985 + CLOSER_MARGIN + 0.001])])!.name).toBe("a");
  });
  test("the best of several, and none without the record's own species", () => {
    const own = stat([0.9])!;
    expect(closerSpecies(own, [other("a", [0.99]), other("b", [0.995]), other("c", [0.7])])!.name).toBe("b");
    expect(closerSpecies(null, [other("a", [1])])).toBeNull();
    expect(closerSpecies(own, [])).toBeNull();
  });
});

describe("recordVerdict", () => {
  const g = (verdict: Parameters<typeof recordVerdict>[0][number]["verdict"], closer = false) => ({ verdict, closer });
  test("order of the verdicts", () => {
    expect(recordVerdict([g("agrees", true), g("agrees")])).toBe("closer_to_other_species");
    expect(recordVerdict([g("agrees"), g("differs")])).toBe("genes_disagree");
    expect(recordVerdict([g("differs"), g("not_assessed")])).toBe("differs");
    expect(recordVerdict([g("mixed"), g("agrees")])).toBe("mixed");
    expect(recordVerdict([g("agrees"), g("differs_one_sequence")])).toBe("agrees");
    expect(recordVerdict([g("differs_one_sequence"), g("not_assessed")])).toBe("differs_one_sequence");
    expect(recordVerdict([g("not_assessed"), g("not_assessed")])).toBe("not_assessed");
    expect(recordVerdict([])).toBe("not_assessed");
  });
});

describe("independent sequences", () => {
  test("FASTA text is split into id, title and sequence", () => {
    const r = parseFasta(">AB1.1 Homo sapiens COI gene\nACGT\nacgt\n\n>X2.1\nTTNN\n");
    expect(r).toEqual([
      { id: "AB1.1", title: "Homo sapiens COI gene", sequence: "ACGTACGT" },
      { id: "X2.1", title: "", sequence: "TTNN" },
    ]);
    expect(parseFasta("")).toEqual([]);
  });
  test("the search keeps whole genomes and RefSeq out", () => {
    const t = searchTerm(9606, "CYTB");
    expect(t).toContain("txid9606[Organism:exp]");
    expect(t).toContain("300:3000[SLEN]");
    expect(t).toContain("NOT refseq[filter]");
  });
});

describe("compareWith, on the committed alignments", () => {
  const cox1 = recordGenes("COX1");
  const cytb = recordGenes("CYTB");
  const slug = [...cox1.keys()].find((s) => cytb.has(s) && /^[ACGT]+$/.test(cox1.get(s)!) && cox1.get(s)!.length > 1400)!;
  const gene = cox1.get(slug)!;

  test("fragments of the gene itself agree; the other strand too", () => {
    const r = compareWith(gene, [
      { id: "a", sequence: gene.slice(0, 650) },
      { id: "b", sequence: reverseComplement(gene.slice(400, 1200)) },
    ]);
    expect(r.stat).toEqual({ n: 2, median: 1, max: 1, min: 1 });
    expect(r.best).toBe("a");
  });

  test("another gene, and a fragment too short to read, are left out and never counted as a difference", () => {
    const r = compareWith(gene, [
      { id: "other-gene", sequence: cytb.get(slug)! },
      { id: "short", sequence: gene.slice(0, MIN_SITES - 1) },
    ]);
    expect(r.stat).toBeNull();
    expect(r.best).toBe("");
  });

  test("another species' gene is compared and differs", () => {
    const other = [...cox1.entries()].find(([s, q]) => s !== slug && q.length > 1400 && s.split("-")[0] !== slug.split("-")[0])!;
    const r = compareWith(gene, [{ id: "x", sequence: other[1] }]);
    expect(r.stat!.n).toBe(1);
    expect(r.stat!.median).toBeGreaterThanOrEqual(SAME_GENE_MIN);
    expect(r.stat!.median).toBeLessThan(1);
  });
});
