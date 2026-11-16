import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { identity, nearIdenticalPairs, type DuplicateInput } from "../lib/duplicates";
import { concatenated, readFasta } from "../duplicates";

const sp = (name: string, sequence: string | null): DuplicateInput => ({
  slug: name.toLowerCase().replace(" ", "-"), scientificName: name, genus: name.split(" ")[0]!, refseq: "X", sequence,
});

describe("identity", () => {
  test("counts only the columns where both have a base", () => {
    const a = "ACGTACGT--NNacgt";
    const b = "ACGAAC--GTACacgt";
    // columns with a base in both: 0-5 and 12-15 (10 columns); differences: column 3
    const shared = [...a].filter((x, i) => /[ACGT]/i.test(x) && /[ACGT]/i.test(b[i]!)).length;
    const same = [...a].filter((x, i) => /[ACGT]/i.test(x) && /[ACGT]/i.test(b[i]!) && x.toUpperCase() === b[i]!.toUpperCase()).length;
    expect(identity(a, b)).toEqual({ sites: shared, identity: same / shared });
    expect(shared).toBe(10);
    expect(same).toBe(9);
  });
  test("is unknown, not zero and not one, when nothing is shared", () => {
    expect(identity("AC--", "--GT")).toEqual({ sites: 0, identity: null });
    expect(identity("", "")).toEqual({ sites: 0, identity: null });
  });
  test("is symmetric and case-blind", () => {
    expect(identity("ACGTN", "acgaA")).toEqual(identity("acgaA", "ACGTN"));
    expect(identity("acgt", "ACGT").identity).toBe(1);
  });
  test("refuses sequences of different length", () => {
    expect(() => identity("ACG", "AC")).toThrow();
  });
});

describe("nearIdenticalPairs", () => {
  const base = "ACGT".repeat(25); // 100 bases
  const oneOff = "T" + base.slice(1);
  const tenOff = "TTTTTTTTTT".replace(/T/g, "G") + base.slice(10); // differs where base has A, C or T: counted below
  const species = [
    sp("Aus beta", oneOff), sp("Aus alpha", base), sp("Aus gamma", tenOff), sp("Aus delta", null),
    sp("Bus alpha", base), sp("Bus beta", "-".repeat(90) + base.slice(90)),
  ];
  test("lists the pairs of one genus at or above the threshold, and counts what it could not judge", () => {
    const r = nearIdenticalPairs(species, 0.99, 50);
    expect(r.pairs.map((p) => [p.a.scientificName, p.b.scientificName])).toEqual([["Aus alpha", "Aus beta"]]);
    expect(r.pairs[0]!.identity).toBe(identity(base, oneOff).identity!);
    expect(r.pairs[0]!.sites).toBe(100);
    // 4 species of Aus give 6 pairs, 2 of Bus give 1
    expect(r.compared).toBe(7);
    // three pairs with the species that has no sequence, and the Bus pair with 10 shared bases
    expect(r.notJudged).toBe(4);
  });
  test("never pairs species of different genera, however alike", () => {
    const r = nearIdenticalPairs(species, 0.5, 50);
    for (const p of r.pairs) expect(p.a.genus).toBe(p.b.genus);
    expect(r.pairs.some((p) => p.a.scientificName === "Aus alpha" && p.b.scientificName === "Bus alpha")).toBe(false);
  });
  test("a pair exactly at the threshold is listed; one below is not", () => {
    const at = identity(base, oneOff).identity!;
    expect(nearIdenticalPairs(species, at, 50).pairs.length).toBe(1);
    expect(nearIdenticalPairs(species, at + 1e-9, 50).pairs.length).toBe(0);
  });
  test("too few shared bases is not judged, even when they all agree", () => {
    const r = nearIdenticalPairs([sp("Bus alpha", base), sp("Bus beta", "-".repeat(90) + base.slice(90))], 0.9, 11);
    expect(r).toEqual({ pairs: [], compared: 1, notJudged: 1 });
    expect(nearIdenticalPairs([sp("Bus alpha", base), sp("Bus beta", "-".repeat(90) + base.slice(90))], 0.9, 10).pairs.length).toBe(1);
  });
  test("orders by identity, highest first, whatever the input order", () => {
    const r1 = nearIdenticalPairs(species, 0.5, 50);
    const r2 = nearIdenticalPairs([...species].reverse(), 0.5, 50);
    expect(r1).toEqual(r2);
    const ids = r1.pairs.map((p) => p.identity);
    expect(ids).toEqual([...ids].sort((x, y) => y - x));
    expect(r1.pairs.length).toBe(3);
    // where the order by name and the order by identity disagree, identity wins
    const c = nearIdenticalPairs([sp("Cus a", base), sp("Cus b", tenOff), sp("Cus c", base)], 0.5, 50);
    expect(c.pairs.map((p) => [p.a.scientificName, p.b.scientificName])[0]).toEqual(["Cus a", "Cus c"]);
    expect(c.pairs[0]!.identity).toBe(1);
    expect(c.pairs[1]!.identity).toBeLessThan(1);
  });
  test("an empty list gives nothing", () => {
    expect(nearIdenticalPairs([], 0.9, 1)).toEqual({ pairs: [], compared: 0, notJudged: 0 });
  });
});

describe("reading the alignments", () => {
  test("readFasta joins wrapped lines and refuses a repeated name", () => {
    expect([...readFasta(">a x\nAC\nGT\n>b\n--\n")]).toEqual([["a", "ACGT"], ["b", "--"]]);
    expect(() => readFasta(">a\nAC\n>a\nGT\n")).toThrow();
  });
  test("concatenates genes in name order, gaps for a missing gene, null for a species in no file", () => {
    const dir = mkdtempSync(join(tmpdir(), "dups-"));
    writeFileSync(join(dir, "B.codon.fasta.gz"), gzipSync(">one\nGGG\n>two\nTTT\n"));
    writeFileSync(join(dir, "A.codon.fasta.gz"), gzipSync(">one\nAC\n"));
    writeFileSync(join(dir, "A.aa.fasta.gz"), gzipSync(">one\nM\n"));
    const m = concatenated(["one", "two", "three"], dir);
    expect(m.get("one")).toBe("ACGGG");
    expect(m.get("two")).toBe("--TTT");
    expect(m.get("three")).toBeNull();
  });
});
