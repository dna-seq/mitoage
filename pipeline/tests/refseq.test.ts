import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR } from "../lib/cache";
import { completeness, locusDate, parseHeader } from "../sources/refseq-release";
import { type ReleaseRecord, compareRecords, onePerSpecies, successorFor } from "../steps/refseq";

const gb = (dir: string, acc: string) => join(CACHE_DIR, dir, `${acc}.gb`);
const read = (dir: string, acc: string) => readFileSync(gb(dir, acc), "utf8");
const have = (dir: string, accs: string[]) => accs.every((a) => existsSync(gb(dir, a)));

describe.skipIf(!have("genbank", ["NC_012920.1"]))("RefSeq headers", () => {
  test("human rCRS header", () => {
    const h = parseHeader(read("genbank", "NC_012920.1"));
    expect(h.version).toBe("NC_012920.1");
    expect(h.accession).toBe("NC_012920");
    expect(h.length).toBe(16569);
    expect(h.taxid).toBe(9606);
    expect(h.topology).toBe("circular");
    expect(h.lineage.split("; ")).toContain("Mammalia");
    expect(h.organism).toBe("Homo sapiens");
    expect(h.updateDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(completeness(h)).toBe("complete_genome");
  });
  test("completeness rule", () => {
    const h = parseHeader(read("genbank", "NC_012920.1"));
    expect(completeness({ ...h, definition: "Homo sapiens mitochondrion, partial genome" })).toBe("excluded_partial");
    expect(completeness({ ...h, definition: "X mitochondrion, chromosome 2, complete sequence" })).toBe("excluded_multipartite");
    expect(completeness({ ...h, definition: "X mitochondrion, complete sequence" })).toBe("complete_sequence");
    expect(completeness({ ...h, version: "NW_1.1", accession: "NW_1" })).toBe("excluded_non_NC_contig");
    expect(completeness({ ...h, definition: "X genome assembly, organelle: mitochondrion", topology: "linear" })).toBe("excluded_assembly_linear");
    expect(completeness({ ...h, definition: "X genome assembly, organelle: mitochondrion" })).toBe("complete_assembly_organelle");
  });
  test("LOCUS dates", () => {
    expect(locusDate("03-APR-2023")).toBe("2023-04-03");
    expect(() => locusDate("2023-04-03")).toThrow();
  });
});

const rec = (dir: string, acc: string, speciesTaxid: number, taxidCurrent: number, lengthQc: "ok" | "short_for_class" = "ok"): ReleaseRecord => {
  const header = parseHeader(read(dir, acc));
  return { header, completeness: completeness(header), taxidCurrent, speciesTaxid, speciesClass: "Mammalia", lengthQc };
};

describe.skipIf(!have("build2/genbank_successors", ["NC_064167.1", "NC_064184.1"]))("one record per species and successors", () => {
  // Sapajus apella: NC_064167.1 is a subspecies record (S. a. macrocephalus) updated later than the
  // species-level NC_064184.1.
  const sub = () => rec("build2/genbank_successors", "NC_064167.1", 9515, 1547595);
  const sp = () => rec("build2/genbank_successors", "NC_064184.1", 9515, 9515);

  test("fixture: the subspecies record is the newer one", () => {
    expect(sub().header.updateDate > sp().header.updateDate).toBe(true);
  });
  test("new species: newest record first", () => {
    const choice = onePerSpecies([sp(), sub()]).get(9515)!;
    expect(choice.chosen.header.version).toBe("NC_064167.1");
    expect(choice.all.map((r) => r.header.version)).toEqual(["NC_064167.1", "NC_064184.1"]);
  });
  test("short records rank after full-length records of the same date", () => {
    const a = { ...sp(), lengthQc: "short_for_class" as const };
    const b = { ...sp(), header: { ...sp().header, version: "NC_000001.1" } };
    expect([a, b].sort(compareRecords)[0]!.lengthQc).toBe("ok");
  });
  test("successor of a build 1 species: species-level record preferred, taken records skipped", () => {
    const choice = onePerSpecies([sp(), sub()]).get(9515);
    expect(successorFor(choice, new Set())?.header.version).toBe("NC_064184.1");
    expect(successorFor(choice, new Set(["NC_064184.1"]))?.header.version).toBe("NC_064167.1");
    expect(successorFor(choice, new Set(["NC_064184.1", "NC_064167.1"]))).toBeNull();
    expect(successorFor(undefined, new Set())).toBeNull();
  });
});
