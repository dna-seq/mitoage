import { describe, expect, test } from "bun:test";
import { CODONS, aminoAcidCounts, countCodons, geneticCode } from "../lib/genetic-code";
import { extractFeature, parseGenBank, parseLocation } from "../lib/genbank";
import {
  type PhyloNode,
  benjaminiHochberg,
  compileTree,
  correlationPValue,
  countBases,
  gcPercent,
  partialCorrelation,
  pearson,
  picCorrelation,
  picFast,
  rank,
  skew,
  spearman,
  tTestTwoTailed,
} from "../lib/stats";
import { featureSpan } from "../steps/genome";
import { fixCsvLabels } from "../steps/regions";
import { slugify, uniqueSpeciesSlugs } from "../steps/taxonomy";

describe("composition", () => {
  test("countBases and GC", () => {
    const b = countBases("AACGTTNg");
    expect(b).toEqual({ a: 2, c: 1, g: 2, t: 2, other: 1 });
    expect(gcPercent(b)).toBeCloseTo((100 * 3) / 7, 10);
    expect(skew(b.g, b.c)).toBeCloseTo(1 / 3, 10);
    expect(skew(0, 0)).toBeNull();
  });

  test("CSV label fix maps complement-labelled columns (human rCRS)", () => {
    const fixed = fixCsvLabels({
      hagrid: 3221, labelG: 5181, labelC: 2169, labelA: 4094, labelT: 5124, other: 1,
      lengthBp: 16569, gcPercent: 44.36, nonCodingBp: 1211, nonCodingNoDloopBp: 89,
    });
    expect(fixed).toEqual({ a: 5124, c: 5181, g: 2169, t: 4094, other: 1 });
  });
});

describe("correlation statistics", () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const y = [2.1, 3.9, 6.2, 8.1, 9.8, 12.2, 13.8, 16.1, 18.2, 19.9];

  test("pearson and spearman", () => {
    expect(pearson(x, x)).toBeCloseTo(1, 12);
    expect(pearson(x, x.map((v) => -v))).toBeCloseTo(-1, 12);
    expect(pearson(x, y)).toBeGreaterThan(0.99);
    expect(spearman(x, x.map((v) => v ** 3))).toBeCloseTo(1, 12);
    expect(Array.from(rank([10, 20, 20, 5]))).toEqual([2, 3.5, 3.5, 1]);
  });

  test("p-values match reference values", () => {
    // t = 2.228, df = 10 -> p = 0.05 (two-tailed)
    expect(tTestTwoTailed(2.228138852, 10)).toBeCloseTo(0.05, 6);
    expect(tTestTwoTailed(0, 5)).toBeCloseTo(1, 12);
    // r = 0.632, n = 10 -> p = 0.05
    expect(correlationPValue(0.6319, 10)).toBeCloseTo(0.05, 3);
  });

  test("partial correlation removes a shared driver", () => {
    const z = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = z.map((v, i) => v + [0.1, -0.2, 0.3, -0.1, 0.2, -0.3, 0.1, 0.2, -0.2, 0][i]!);
    const b = z.map((v, i) => 2 * v + [-0.1, 0.1, 0.2, -0.3, 0.1, 0.2, -0.1, -0.2, 0.3, 0.1][i]!);
    expect(pearson(a, b)).toBeGreaterThan(0.98);
    expect(Math.abs(partialCorrelation(a, b, z))).toBeLessThan(0.6);
  });

  test("Benjamini-Hochberg", () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.005, Number.NaN]);
    expect(q[3]).toBeCloseTo(0.02, 12);
    expect(q[0]).toBeCloseTo(0.02, 12);
    expect(q[2]).toBeCloseTo(0.04, 12);
    expect(q[1]).toBeCloseTo(0.04, 12);
    expect(Number.isNaN(q[4]!)).toBe(true);
  });
});

describe("phylogenetic independent contrasts", () => {
  // ((1:1,2:1):1,(3:1,4:1):1)
  const tree: PhyloNode = {
    length: 0,
    children: [
      { length: 1, children: [{ length: 1, children: [], leaf: 1 }, { length: 1, children: [], leaf: 2 }] },
      { length: 1, children: [{ length: 1, children: [], leaf: 3 }, { length: 1, children: [], leaf: 4 }] },
    ],
  };
  test("contrasts on a balanced tree", () => {
    const x = new Map([[1, 1], [2, 3], [3, 5], [4, 9]]);
    const y = new Map([[1, 2], [2, 6], [3, 10], [4, 18]]);
    const r = picCorrelation(tree, x, y);
    expect(r?.contrasts).toBe(3);
    expect(r?.r).toBeCloseTo(1, 12); // y = 2x exactly
  });
  test("compiled version agrees", () => {
    const xs = [1, 3, 5, 9];
    const ys = [2, 5, 4, 11];
    const slow = picCorrelation(tree, new Map(xs.map((v, i) => [i + 1, v])), new Map(ys.map((v, i) => [i + 1, v])));
    const fast = picFast(compileTree(tree, (leaf) => leaf - 1), xs, ys);
    expect(fast?.r).toBeCloseTo(slow!.r, 12);
    expect(fast?.p).toBeCloseTo(slow!.p, 12);
  });
});

describe("genetic code and codons", () => {
  test("vertebrate mitochondrial code", () => {
    const c = geneticCode(2);
    expect(c["AGA"]).toBe("*");
    expect(c["UGA"]).toBe("W");
    expect(c["AUA"]).toBe("M");
    expect(geneticCode(5)["AGG"]).toBe("S");
    expect(geneticCode(9)["AAA"]).toBe("N");
    expect(CODONS).toHaveLength(64);
  });
  test("codon and amino-acid counts", () => {
    const { counts } = countCodons("ATGTGAAGATTA", 1);
    expect(counts["AUG"]).toBe(1);
    expect(counts["UGA"]).toBe(1);
    const aa = aminoAcidCounts(counts, 2);
    expect(aa["M"]).toBe(1);
    expect(aa["W"]).toBe(1);
    expect(aa["*"]).toBe(1);
    expect(aa["L"]).toBe(1);
  });
});

describe("GenBank locations", () => {
  test("complement(join()) order and wrap-around spans", () => {
    const { segments } = parseLocation("complement(join(10..20,30..40))");
    expect(segments).toEqual([
      { start: 30, end: 40, strand: -1 },
      { start: 10, end: 20, strand: -1 },
    ]);
    expect(featureSpan(parseLocation("join(16024..16569,1..576)").segments, 16569)).toEqual({ start: 16024, end: 576, strand: 1 });
    expect(featureSpan(segments, 100)).toEqual({ start: 10, end: 40, strand: -1 });
    expect(parseLocation("<1..>50").partial).toBe(true);
  });
  test("extractFeature reverse-complements minus strand", () => {
    expect(extractFeature("AAACCCGGGTTT", parseLocation("complement(1..6)").segments)).toBe("GGGTTT");
  });
  test("minimal record", () => {
    const rec = parseGenBank(
      [
        "LOCUS       TEST                      12 bp    DNA     circular VRT 01-JAN-2020",
        "DEFINITION  Test mitochondrion,",
        "            complete genome.",
        "VERSION     NC_000000.1",
        "FEATURES             Location/Qualifiers",
        "     CDS             1..9",
        '                     /gene="COI"',
        '                     /product="cytochrome c oxidase subunit',
        '                     I"',
        "ORIGIN",
        "        1 atgaaatag a",
        "//",
      ].join("\n"),
    );
    expect(rec.length).toBe(12);
    expect(rec.circular).toBe(true);
    expect(rec.definition).toBe("Test mitochondrion, complete genome.");
    expect(rec.features[0]?.qualifiers["product"]?.[0]).toBe("cytochrome c oxidase subunit I");
    expect(rec.sequence).toBe("ATGAAATAGA");
  });
});

describe("slugs", () => {
  test("slugify and uniqueness", () => {
    expect(slugify("Homo sapiens")).toBe("homo-sapiens");
    expect(slugify("Canis lupus familiaris")).toBe("canis-lupus-familiaris");
    expect(slugify("Ateles geoffroyi (x)")).toBe("ateles-geoffroyi-x");
    const s = uniqueSpeciesSlugs([
      { id: 1, scientificName: "Mus musculus", refseq: "NC_005089.1" },
      { id: 2, scientificName: "Mus  musculus", refseq: "NC_000001.1" },
    ]);
    expect(s.get(1)).toBe("mus-musculus");
    expect(s.get(2)).toBe("mus-musculus-nc-000001-1");
  });
});
