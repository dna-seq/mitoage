import { describe, expect, test } from "bun:test";
import { getAllSpecies } from "~/data";
import { GET } from "~/pages/species/retired.json";
import { readRetired, retiredRecords, retiredSentence } from "./retired";

const SPECIES = getAllSpecies();
const RETIRED = retiredRecords(SPECIES);

describe("retiredRecords", () => {
  test("exactly the species the data gives record status retired, each with its reason", () => {
    const want = SPECIES.filter((s) => s.provenance?.recordStatus === "retired");
    expect(new Set(RETIRED.map((r) => r.slug))).toEqual(new Set(want.map((s) => s.slug)));
    expect(RETIRED.length).toBe(want.length);
    expect(RETIRED.length).toBeGreaterThan(0);
    for (const r of RETIRED) {
      const s = SPECIES.find((x) => x.slug === r.slug);
      expect([s?.refseq, s?.scientificName]).toEqual([r.accession, r.name]);
      expect(s?.retiredReason).toBeTruthy();
    }
    // No species retired by its reason alone, without the status.
    expect(SPECIES.filter((s) => s.retiredReason).length).toBe(RETIRED.length);
  });

  test("ordered by accession, each once; empty when nothing is retired", () => {
    const acc = RETIRED.map((r) => r.accession);
    expect(acc).toEqual([...acc].sort());
    expect(new Set(acc).size).toBe(acc.length);
    expect(retiredRecords([])).toEqual([]);
    expect(retiredRecords(SPECIES.filter((s) => s.provenance?.recordStatus !== "retired"))).toEqual([]);
  });

  test("no species page shadows the file: no species is called 'retired'", () => {
    expect(SPECIES.some((s) => s.slug === "retired")).toBe(false);
  });
});

describe("/species/retired.json", () => {
  test("serves the retired records, and reads back as them", async () => {
    const res = await (GET as unknown as () => Response)();
    const body = (await res.json()) as unknown;
    expect(body).toEqual({ retired: RETIRED });
    const map = readRetired(body);
    expect([...map.values()]).toEqual(RETIRED);
    expect([...map.keys()]).toEqual(RETIRED.map((r) => r.accession));
  });
});

describe("readRetired", () => {
  test("refuses a malformed body rather than reading it as no record", () => {
    const one = RETIRED[0];
    for (const bad of [null, {}, { retired: "x" }, { retired: [{}] }, { retired: [{ ...one, accession: "" }] }, { retired: [{ ...one, name: 3 }] }])
      expect(() => readRetired(bad)).toThrow("malformed");
    expect(readRetired({ retired: [] }).size).toBe(0);
  });
});

describe("retiredSentence", () => {
  test("none is no sentence", () => {
    expect(retiredSentence([], 0)).toBeUndefined();
    expect(retiredSentence([], 5)).toBeUndefined();
  });

  test("names the records in the order given, cut after eight with how many more", () => {
    const back = [...RETIRED].reverse();
    expect(back.length).toBeGreaterThan(8);
    const s = retiredSentence(back, back.length) ?? "";
    const named = back.filter((r) => s.includes(r.name));
    expect(named).toEqual(back.slice(0, 8));
    expect(s.endsWith(`: ${back.slice(0, 8).map((r) => r.name).join(", ")} and ${back.length - 8} more.`)).toBe(true);
    expect(s.startsWith(`${back.length} of them are retired records`)).toBe(true);
    const few = back.slice(0, 3);
    expect(retiredSentence(few, 10)?.endsWith(`: ${few.map((r) => r.name).join(", ")}.`)).toBe(true);
  });

  test("one record: 'One of them' among others, 'It' when it is the whole file", () => {
    const one = RETIRED.slice(0, 1);
    expect(retiredSentence(one, 4)?.startsWith("One of them is a retired record")).toBe(true);
    expect(retiredSentence(one, 1)?.startsWith("It is a retired record")).toBe(true);
  });
});
