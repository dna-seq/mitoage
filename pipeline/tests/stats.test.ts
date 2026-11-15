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
  contrastCorrelation,
  picContrasts,
  picCorrelation,
  picFast,
  signFlipPValue,
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

describe("sign-flip p value of contrasts", () => {
  // A ladder tree of 12 leaves: (((((1,2),3),4)...),12), unit branches, so 11 contrasts.
  const ladder = (k: number): PhyloNode => {
    let node: PhyloNode = { length: 1, children: [], leaf: 1 };
    for (let i = 2; i <= k; i++) node = { length: 1, children: [node, { length: 1, children: [], leaf: i }] };
    return { ...node, length: 0 };
  };
  const t = compileTree(ladder(12), (leaf) => leaf - 1);
  const xs = [0.3, 1.1, -0.4, 2.0, 0.9, -1.3, 0.2, 1.7, -0.8, 0.5, 1.4, -0.1];
  const ys = [1.0, 0.2, 0.7, 1.9, -0.6, -0.9, 0.8, 1.2, 0.1, -0.3, 2.2, 0.4];
  /** The exact sign-flip p value: every one of the 2^m sign patterns, counted. */
  const exact = (cx: Float64Array, cy: Float64Array) => {
    const m = cx.length;
    const prod = Array.from(cx, (v, i) => v * cy[i]!);
    const obs = Math.abs(prod.reduce((a, b) => a + b, 0));
    let hits = 0;
    for (let mask = 0; mask < 1 << m; mask++) {
      let s = 0;
      for (let i = 0; i < m; i++) s += mask & (1 << i) ? prod[i]! : -prod[i]!;
      if (Math.abs(s) >= obs * (1 - 1e-12)) hits++;
    }
    return hits / (1 << m);
  };
  test("agrees with exact enumeration of all sign patterns", () => {
    const { cx, cy } = picContrasts(t, xs, ys);
    expect(cx.length).toBe(11);
    const want = exact(cx, cy);
    const got = signFlipPValue(cx, cy, 40000, 7)!;
    // Monte Carlo standard error at 40,000 flips is at most 0.0025.
    expect(Math.abs(got - want)).toBeLessThan(0.01);
  });
  test("the contrasts are the ones picFast correlates", () => {
    const { cx, cy } = picContrasts(t, xs, ys);
    const fast = picFast(t, xs, ys)!;
    const viaContrasts = contrastCorrelation(cx, cy)!;
    expect(viaContrasts.r).toBe(fast.r);
    expect(viaContrasts.contrasts).toBe(fast.contrasts);
  });
  test("one shared contrast does not pass for many: t test rejects, sign flips do not", () => {
    const m = 30;
    const cx = new Float64Array(m);
    const cy = new Float64Array(m);
    for (let i = 1; i < m; i++) {
      cx[i] = Math.sin(i * 1.7) * 0.3;
      cy[i] = Math.cos(i * 2.3) * 0.3;
    }
    cx[0] = 5;
    cy[0] = 5;
    expect(contrastCorrelation(cx, cy)!.p).toBeLessThan(1e-6);
    expect(signFlipPValue(cx, cy, 9999, 1)!).toBeGreaterThan(0.4);
  });
  test("depends on the sizes of the products, not on their signs or order", () => {
    const { cx, cy } = picContrasts(t, xs, ys);
    const p = signFlipPValue(cx, cy, 9999, 42)!;
    expect(signFlipPValue(cx, cy, 9999, 42)).toBe(p);
    expect(signFlipPValue(cx, cy.map((v) => -v), 9999, 42)).toBe(p);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(1);
  });
  test("no p value without three contrasts or with a constant trait", () => {
    expect(signFlipPValue([1, 2], [1, 2], 99, 1)).toBeNull();
    expect(signFlipPValue([1, 2, 3], [0, 0, 0], 99, 1)).toBeNull();
    expect(signFlipPValue([], [], 99, 1)).toBeNull();
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
