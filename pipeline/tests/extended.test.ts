import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { cachePath } from "../lib/cache";
import { extractFeature } from "../lib/genbank";
import { CODONS, aminoAcidCounts, countCodons, geneticCode } from "../lib/genetic-code";
import { directRepeats, findRepeats, invertedRepeats, mirrorRepeats, summariseRepeats } from "../lib/repeats";
import { HOMOPOLYMER_MIN, STR_MIN_UNITS, TRACT_MIN, countMotifs, tandemRepeats } from "../lib/motifs";
import {
  KYTE_DOOLITTLE,
  bridgingPairs,
  contactZones,
  fourfoldCounts,
  fourfoldPrefixes,
  gravy,
  majorArc,
  orientationOf,
  regionSequence,
  toHeavyStrand,
} from "../steps/extended";
import { annotateGenome } from "../steps/genome";

const COMPLEMENT: Record<string, string> = { A: "T", C: "G", G: "C", T: "A" };
const revcomp = (s: string) => [...s].reverse().map((c) => COMPLEMENT[c]!).join("");

describe("fourfold-degenerate sites", () => {
  test("vertebrate code: the eight fourfold families (Ala, Gly, Pro, Thr, Val, Leu CUN, Ser UCN, Arg CGN)", () => {
    expect(fourfoldPrefixes(2).sort()).toEqual(["AC", "CC", "CG", "CU", "GC", "GG", "GU", "UC"]);
  });

  test("invertebrate and echinoderm codes add AGN (Ser); the ascidian code splits it (AGR Gly, AGY Ser)", () => {
    for (const table of [5, 9]) expect(fourfoldPrefixes(table).sort()).toEqual([...fourfoldPrefixes(2), "AG"].sort());
    expect(fourfoldPrefixes(13).sort()).toEqual(fourfoldPrefixes(2).sort());
  });

  test("every prefix returned is a single non-stop amino acid, every other prefix is not", () => {
    for (const table of [1, 2, 4, 5, 9, 13, 14]) {
      const code = geneticCode(table);
      const ff = new Set(fourfoldPrefixes(table));
      for (const a of "UCAG") {
        for (const b of "UCAG") {
          const aas = new Set([..."UCAG"].map((c) => code[a + b + c]));
          expect(ff.has(a + b)).toBe(aas.size === 1 && !aas.has("*"));
        }
      }
    }
  });

  test("fourfold counts read only the third position of fourfold codons", () => {
    const counts = Object.fromEntries(CODONS.map((c) => [c, 0]));
    counts["GCA"] = 3; // Ala, fourfold
    counts["CUG"] = 2; // Leu CUN, fourfold
    counts["UUA"] = 7; // Leu UUR, twofold: ignored
    counts["AGU"] = 5; // Ser AGY: fourfold only where AGN is Ser
    expect(fourfoldCounts(counts, 2)).toEqual({ a: 3, c: 0, g: 2, u: 0 });
    expect(fourfoldCounts(counts, 5)).toEqual({ a: 3, c: 0, g: 2, u: 5 });
    expect(fourfoldCounts({}, 2)).toEqual({ a: 0, c: 0, g: 0, u: 0 });
  });

  test("heavy-strand notation complements + strand genes and keeps - strand genes", () => {
    const t = { a: 1, c: 2, g: 3, u: 4 };
    expect(toHeavyStrand(t, 1)).toEqual({ a: 4, c: 3, g: 2, t: 1 });
    expect(toHeavyStrand(t, -1)).toEqual({ a: 1, c: 2, g: 3, t: 4 });
  });
});

describe("hydropathy", () => {
  test("GRAVY is the count-weighted Kyte-Doolittle mean, stops excluded", () => {
    expect(gravy({ I: 1, R: 1, "*": 5 })).toBeCloseTo((4.5 - 4.5) / 2, 12);
    expect(gravy({ L: 3, K: 1 })).toBeCloseTo((3 * 3.8 - 3.9) / 4, 12);
    expect(gravy({ "*": 2 })).toBeNull();
    expect(gravy({})).toBeNull();
    expect(Object.keys(KYTE_DOOLITTLE).length).toBe(20);
  });
});

describe("repeats", () => {
  test("empty and repeat-free sequences", () => {
    expect(directRepeats("", 10)).toEqual([]);
    expect(invertedRepeats("ACGT", 10)).toEqual([]);
    expect(summariseRepeats("ACGTACGTA", 10)).toEqual({ direct: 0, inverted: 0, mirror: 0, longestDirect: null });
  });

  test("a planted direct repeat is found once, at full (maximal) length", () => {
    const rep = "GATTACAGATTC"; // 12 bp
    const s = `CC${rep}TTTTTTTTTTTTTT${rep}GG`;
    const d = directRepeats(s, 10);
    expect(d).toEqual([{ first: 2, second: 2 + rep.length + 14, length: rep.length }]);
    expect(s.slice(d[0]!.first, d[0]!.first + 12)).toBe(s.slice(d[0]!.second, d[0]!.second + 12));
  });

  test("an ambiguous base breaks a repeat", () => {
    const rep = "GATTACAGATTC";
    const broken = `${rep.slice(0, 6)}N${rep.slice(7)}`;
    expect(directRepeats(`${rep}AAAAAA${broken}`, 10)).toEqual([]);
  });

  test("the two copies of a direct repeat never overlap", () => {
    const tandem = "ACGTTGCAAG".repeat(3); // three tandem 10-mers: pairs (0,10), (10,20) and (0,20)
    for (const p of directRepeats(tandem, 10)) expect(p.first + p.length).toBeLessThanOrEqual(p.second);
    expect(directRepeats(tandem, 10).length).toBeGreaterThan(0);
  });

  test("a planted inverted repeat (hairpin stem) is found once, maximal, with disjoint arms", () => {
    const arm = "GATTACAGGTC"; // 11 bp
    const s = `GG${arm}CCCC${revcomp(arm)}GG`; // flanks that do not pair (C-G would extend the stem)
    const inv = invertedRepeats(s, 10);
    expect(inv.length).toBe(1);
    const p = inv[0]!;
    expect(p.length).toBe(arm.length);
    expect(s.slice(p.second, p.second + p.length)).toBe(revcomp(s.slice(p.first, p.first + p.length)));
    expect(p.first + p.length).toBeLessThanOrEqual(p.second);
  });

  test("region sequence wraps the origin when start > end", () => {
    expect(regionSequence("ABCDEFG", 2, 4)).toBe("BCD");
    expect(regionSequence("ABCDEFG", 6, 2)).toBe("FGAB");
  });
});

const HUMAN = cachePath("genbank", "NC_012920.1.gb");

describe("human rCRS (NC_012920.1, cached RefSeq record)", () => {
  test.skipIf(!existsSync(HUMAN))("canonical orientation and the major arc from tRNA-Asn to the D-loop", async () => {
    const g = annotateGenome(await Bun.file(HUMAN).text(), 2, true);
    expect(orientationOf(g, "Chordata")).toBe("canonical");
    expect(orientationOf(g, "Arthropoda")).toBe("not_chordate");
    expect(orientationOf(undefined, "Chordata")).toBe("unknown");
    const asn = g.features.find((f) => f.name === "tRNA-Asn")!;
    const dloop = g.features.find((f) => f.type === "D-loop")!;
    const arc = majorArc(g, "canonical")!;
    expect(arc.start).toBe(asn.end + 1);
    expect(arc.end).toBe(dloop.start - 1);
    expect(arc.length).toBe(arc.end - arc.start + 1);
    expect(majorArc(g, "noncanonical")).toBeNull();
  });

  test.skipIf(!existsSync(HUMAN))("the 13-bp repeat flanking the common deletion (8470-8482 / 13447-13459) is a major-arc direct repeat", async () => {
    const g = annotateGenome(await Bun.file(HUMAN).text(), 2, true);
    const arc = majorArc(g, "canonical")!;
    const seq = g.record.sequence.toUpperCase();
    const pairs = directRepeats(regionSequence(seq, arc.start, arc.end), 10).map((p) => ({
      first: p.first + arc.start,
      second: p.second + arc.start,
      length: p.length,
    }));
    expect(pairs).toContainEqual({ first: 8470, second: 13447, length: 13 });
    expect(seq.slice(8469, 8482)).toBe(seq.slice(13446, 13459));
  });

  test.skipIf(!existsSync(HUMAN))("fourfold counts from codon tables equal a direct count of CDS third positions", async () => {
    const g = annotateGenome(await Bun.file(HUMAN).text(), 2, true);
    const prefixes = new Set(fourfoldPrefixes(g.translTable));
    for (const f of g.features.filter((x) => x.type === "CDS")) {
      const cds = extractFeature(g.record.sequence, f.segments).toUpperCase().replace(/T/g, "U");
      const direct = { a: 0, c: 0, g: 0, u: 0 };
      for (let i = f.codonStart - 1; i + 3 <= cds.length; i += 3) {
        if (!prefixes.has(cds.slice(i, i + 2))) continue;
        const b = cds[i + 2]!.toLowerCase() as "a" | "c" | "g" | "u";
        if (b in direct) direct[b]++;
      }
      const { counts } = countCodons(extractFeature(g.record.sequence, f.segments), f.codonStart);
      expect(fourfoldCounts(counts, g.translTable)).toEqual(direct);
      const aa = aminoAcidCounts(counts, g.translTable);
      const n = Object.entries(aa).filter(([k]) => k !== "*").reduce((s, [, v]) => s + v, 0);
      if (n > 0) expect(gravy(aa)).not.toBeNull();
    }
  });
});

describe("mirror repeats", () => {
  const reverse = (s: string) => [...s].reverse().join("");

  test("a planted mirror repeat is found, with the arms read backwards and disjoint", () => {
    const arm = "GATTACAGGTC"; // 11 bp
    // Flanks chosen so the mirror cannot grow: outward C never meets A, inward A never meets T.
    const s = `CC${arm}AAATTT${reverse(arm)}AA`;
    const m = mirrorRepeats(s, 10);
    expect(m.length).toBe(1);
    const p = m[0]!;
    expect(p.length).toBe(arm.length);
    expect(s.slice(p.second, p.second + p.length)).toBe(reverse(s.slice(p.first, p.first + p.length)));
    expect(p.first + p.length).toBeLessThanOrEqual(p.second);
  });

  test("a mirror repeat is not an inverted repeat unless the arms are also complementary", () => {
    const arm = "AAAAGAAAAG"; // reverse is GAAAAGAAAA; the reverse complement is CTTTTCTTTT
    const s = `CC${arm}TTTTTT${reverse(arm)}CC`;
    expect(mirrorRepeats(s, 10).length).toBeGreaterThan(0);
    expect(invertedRepeats(s, 10)).toEqual([]);
  });

  test("a palindrome of complementary bases is found by both scans", () => {
    const arm = "GGCCATATGG";
    const s = `TT${arm}AAAAAA${reverse(arm)}TT`;
    expect(mirrorRepeats(s, 10).length).toBeGreaterThan(0);
    const rc = `TT${arm}AAAAAA${[...arm].reverse().map((c) => ({ A: "T", C: "G", G: "C", T: "A" })[c]!).join("")}TT`;
    expect(invertedRepeats(rc, 10).length).toBeGreaterThan(0);
  });

  test("findRepeats returns the same lists the three scans return separately", () => {
    const s = "GATTACAGGTCCCCCGACCTGTAATCAAAAAAAAGATTACAGGTC";
    const f = findRepeats(s, 10);
    expect(f.direct).toEqual(directRepeats(s, 10));
    expect(f.inverted).toEqual(invertedRepeats(s, 10));
    expect(f.mirror).toEqual(mirrorRepeats(s, 10));
  });
});

describe("non-B motifs", () => {
  test("a G-quadruplex motif needs four G-runs; three is not enough, and the C-run form counts on the other strand", () => {
    const g4 = `GGG${"A"}GGG${"AT"}GGG${"A"}GGG`;
    expect(countMotifs(g4).g4Forward).toBe(1);
    expect(countMotifs(g4).g4Reverse).toBe(0);
    expect(countMotifs(`GGG${"A"}GGG${"AT"}GGG`).g4Forward).toBe(0);
    const c4 = [...g4].map((c) => (c === "G" ? "C" : c)).join("");
    expect(countMotifs(c4).g4Reverse).toBe(1);
    expect(countMotifs(c4).g4Forward).toBe(0);
  });

  test("a loop longer than seven bases breaks the quadruplex motif", () => {
    const loop = (n: number) => `GGG${"A".repeat(n)}GGGAGGGAGGG`;
    expect(countMotifs(loop(7)).g4Forward).toBe(1);
    expect(countMotifs(loop(8)).g4Forward).toBe(0);
  });

  test("the published thresholds are the ones the scanners use", () => {
    // Literals, not the constants: a test that builds its fixture from the constant it checks
    // moves with the constant and cannot catch a change to it.
    expect(HOMOPOLYMER_MIN).toBe(5);
    expect(TRACT_MIN).toBe(15);
    expect(STR_MIN_UNITS).toBe(3);
  });

  test("tracts are counted at the minimum length and not below it", () => {
    expect(countMotifs("AAAAAAAAAAAAAAA").purineTracts).toBe(1); // 15 purines
    expect(countMotifs("AAAAAAAAAAAAAA").purineTracts).toBe(0); // 14
    expect(countMotifs("CCCCCCCCCCCCCCC").pyrimidineTracts).toBe(1);
    // a purine tract is not a pyrimidine tract
    expect(countMotifs("AAAAAAAAAAAAAAA").pyrimidineTracts).toBe(0);
    expect(countMotifs("A".repeat(TRACT_MIN)).purineTracts).toBe(1);
    expect(countMotifs("A".repeat(TRACT_MIN - 1)).purineTracts).toBe(0);
  });

  test("homopolymer runs: counted at the minimum, and the longest is reported", () => {
    expect(countMotifs("AAAAA").homopolymerRuns).toBe(1); // exactly 5
    expect(countMotifs("AAAA").homopolymerRuns).toBe(0); // 4
    const s = "AAAAACTTTTTTTTTCGGGG"; // a 5-run, a 9-run, and a 4-run that does not count
    const m = countMotifs(s);
    expect(m.homopolymerRuns).toBe(2);
    expect(m.longestHomopolymer).toBe(9);
    expect(countMotifs("ACGTACGT").homopolymerRuns).toBe(0);
    expect(countMotifs("ACGTACGT").longestHomopolymer).toBeNull();
  });

  test("tandem repeats need whole units, and a unit built from a shorter period is left to that length", () => {
    expect(tandemRepeats("AC".repeat(STR_MIN_UNITS), 2).count).toBe(1);
    expect(tandemRepeats("AC".repeat(STR_MIN_UNITS - 1), 2).count).toBe(0);
    // AAAAAA is a run of one base: it is a homopolymer, not a dinucleotide or tetranucleotide repeat
    expect(tandemRepeats("A".repeat(12), 2).count).toBe(0);
    expect(tandemRepeats("A".repeat(12), 4).count).toBe(0);
    // ACACACAC as a tetranucleotide unit (ACAC) repeats a dinucleotide: left to unit 2
    expect(tandemRepeats("ACAC".repeat(STR_MIN_UNITS), 4).count).toBe(0);
    expect(tandemRepeats("ACAC".repeat(STR_MIN_UNITS), 2).count).toBe(1);
    const tri = tandemRepeats("ACG".repeat(4), 3);
    expect(tri.count).toBe(1);
    expect(tri.bases).toBe(12);
  });

  test("the empty sequence has no motifs at all", () => {
    const m = countMotifs("");
    expect(m).toEqual({
      g4Forward: 0, g4Reverse: 0, purineTracts: 0, pyrimidineTracts: 0,
      homopolymerRuns: 0, longestHomopolymer: null,
      strDinucleotide: 0, strTrinucleotide: 0, strTetranucleotide: 0, strBases: 0,
    });
  });
});

describe("contact zones", () => {
  const feat = (name: string, start: number, end: number) => ({ name, type: "CDS", start, end, strand: 1 as const });
  const genomeOf = (features: ReturnType<typeof feat>[]) =>
    ({ features, record: { sequence: "A".repeat(20000) } }) as never;

  test("the zones span ATP8 to COX3 and ND5 to CYTB", () => {
    const z = contactZones(
      genomeOf([feat("ATP8", 7500, 7700), feat("COX3", 9200, 9990), feat("ND5", 12300, 14100), feat("CYTB", 14700, 15800)]),
    );
    expect(z).toEqual({ zone1: { start: 7500, end: 9990 }, zone2: { start: 12300, end: 15800 } });
  });

  test("undefined when a gene is missing, duplicated, wraps the origin, or the order is wrong", () => {
    const ok = [feat("ATP8", 7500, 7700), feat("COX3", 9200, 9990), feat("ND5", 12300, 14100), feat("CYTB", 14700, 15800)];
    expect(contactZones(genomeOf(ok.slice(1)))).toBeNull();
    expect(contactZones(genomeOf([...ok, feat("ND5", 100, 200)]))).toBeNull();
    expect(contactZones(genomeOf(ok.map((f) => (f.name === "CYTB" ? feat("CYTB", 15800, 14700) : f))))).toBeNull();
    // zones that overlap: COX3 ends after ND5 starts
    expect(contactZones(genomeOf(ok.map((f) => (f.name === "COX3" ? feat("COX3", 9200, 12500) : f))))).toBeNull();
    expect(contactZones(undefined)).toBeNull();
  });

  test("a pair counts only when one arm lies in each zone, whichever way round", () => {
    const zones = { zone1: { start: 100, end: 200 }, zone2: { start: 500, end: 600 } };
    const pair = (first: number, second: number) => ({ first, second, length: 10 });
    // 0-based arms: 149 -> position 150 (zone 1), 549 -> 550 (zone 2)
    expect(bridgingPairs([pair(149, 549)], zones)).toBe(1);
    expect(bridgingPairs([pair(549, 149)], zones)).toBe(1);
    expect(bridgingPairs([pair(149, 159)], zones)).toBe(0); // both in zone 1
    expect(bridgingPairs([pair(149, 999)], zones)).toBe(0); // second arm outside both
    expect(bridgingPairs([], zones)).toBe(0);
    // the zone boundaries are inclusive in 1-based coordinates
    expect(bridgingPairs([pair(99, 499)], zones)).toBe(1);
    expect(bridgingPairs([pair(98, 499)], zones)).toBe(0);
  });
});
