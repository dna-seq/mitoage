import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_DIR, complexesOf, parseTsv, sitesOf } from "../complexes";
import { contactMatrix, contactsWith, summariseGene } from "../../src/lib/complexes";

const chainRows = parseTsv(readFileSync(join(SOURCE_DIR, "CHAINS.tsv"), "utf8"));
const siteRows = parseTsv(readFileSync(join(SOURCE_DIR, "SITES.tsv"), "utf8"));
const complexes = complexesOf(chainRows, siteRows);
const iv = complexes.find((c) => c.id === "iv")!;

describe("complexes", () => {
  test("every row of the tables lands in exactly one place", () => {
    expect(complexes.reduce((a, c) => a + c.chains.length, 0)).toBe(chainRows.length);
    const placed = complexes.flatMap((c) => c.sites ?? []).reduce((a, g) => a + g.sites.length, 0);
    expect(placed).toBe(siteRows.length);
    expect(complexes.map((c) => c.id)).toEqual(["i", "iii", "iv", "v"]);
  });

  test("a subunit's sites are its chain, residue by residue, in order", () => {
    for (const g of iv.sites!) {
      const chain = iv.chains.find((c) => c.gene === g.gene)!;
      expect(chain.mitochondrial).toBe(true);
      expect(g.sites.length).toBe(chain.residues);
      // along the chain, no residue twice (the structure may lack the first ones: COX3 starts at 2)
      for (let i = 1; i < g.sites.length; i++) expect(g.sites[i]!.pos).toBeGreaterThan(g.sites[i - 1]!.pos);
    }
  });

  test("contact counts agree with the table read directly", () => {
    for (const g of iv.sites!) {
      const rows = siteRows.filter((r) => r.gene === g.gene);
      expect(summariseGene(g).contact).toBe(rows.filter((r) => r.group === "contact").length);
      // matched one to one: as many control residues as contact residues
      expect(g.sites.filter((s) => s.group === "control").length).toBe(summariseGene(g).contact);
    }
  });

  test("the matrix sums to the partner mentions of the table, and each cell lists its residues", () => {
    const m = contactMatrix(iv);
    let cells = 0;
    for (const g of iv.sites!) for (const p of m.partners) {
      cells += m.count(g.gene, p);
      expect(contactsWith(g, p).length).toBe(m.count(g.gene, p));
    }
    const partnersOf = (r: Record<string, string>): string[] => ((r.partners ?? "") === "" ? [] : (r.partners ?? "").split(","));
    const mentions = siteRows.reduce((a, r) => a + partnersOf(r).length, 0);
    expect(cells).toBe(mentions);
    // every partner named in the table is a nuclear chain of the structure
    const named = new Set(siteRows.flatMap(partnersOf));
    for (const p of named) expect(m.partners).toContain(p);
  });

  test("a complex without a table has no sites, never an empty list", () => {
    for (const c of complexes) if (c.id !== "iv") expect(c.sites).toBeNull();
  });

  test("malformed input is refused", () => {
    expect(() => parseTsv("a\tb\n1\n")).toThrow();
    const bad = siteRows.slice(0, 3).map((r) => ({ ...r }));
    bad[1]!.group = "interface";
    expect(() => sitesOf(bad)).toThrow(/unknown group/);
    const contactless = siteRows.filter((r) => r.group === "contact").slice(0, 1).map((r) => ({ ...r, partners: "" }));
    expect(() => sitesOf(contactless)).toThrow(/partners/);
    const nan = siteRows.slice(0, 1).map((r) => ({ ...r, aln_col: "" }));
    expect(() => sitesOf(nan)).toThrow(/aln_col/);
    expect(() => complexesOf([{ ...chainRows[0], pdb: "0XXX" }], [])).toThrow(/no complex is known/);
    expect(() => complexesOf(chainRows, siteRows.slice(0, 10))).toThrow(/sites, its chain has/);
  });
});
