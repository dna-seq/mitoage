import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { pdfTextRuns } from "../lib/pdf-text";
import { loadEuring, parseEuringAge, parseEuringList } from "../sources/euring";
import { EURING, cacheFile } from "../sources/pinned";
import { type MatchedObservation, chooseLifespan } from "../steps/lifespan";

describe("EURING ages", () => {
  test("years and months", () => {
    expect(parseEuringAge("37y 0m")).toEqual({ years: 37, note: null });
    expect(parseEuringAge("30y 9m").years).toBeCloseTo(30.75, 10);
    expect(parseEuringAge("12 y 11m").years).toBeCloseTo(12 + 11 / 12, 10);
    expect(parseEuringAge("10y 7m ").years).toBeCloseTo(10 + 7 / 12, 10);
  });
  test("an unreadable month keeps the years and says so; an unreadable cell is unknown", () => {
    const quail = parseEuringAge("11y im");
    expect(quail.years).toBe(11);
    expect(quail.note).toContain('"im"');
    expect(parseEuringAge("5y 12m").years).toBe(5);
    expect(parseEuringAge("").years).toBeNull();
    expect(parseEuringAge("about 9 years")).toEqual({ years: null, note: 'age "about 9 years" not readable' });
  });
});

describe("EURING list structure", () => {
  const run = (page: number, x: number, y: number, font: string, text: string) => ({ page, x, y, font, text });
  const header = [run(1, 24, 645, "Arial-BoldMT", "Species / Scientific name"), run(1, 365, 645, "Arial-BoldMT", "Age")];
  test("a species without its scientific-name row is refused", () => {
    expect(() => parseEuringList([...header, run(1, 24, 624, "Arial-BoldMT", "Quail "), run(1, 359, 624, "ArialMT", "12y 1m")])).toThrow(/no scientific name/);
  });
  test("a scientific name with no common name above it is refused", () => {
    expect(() => parseEuringList([...header, run(1, 24, 610, "Arial-ItalicMT", "Coturnix coturnix")])).toThrow(/follows no common name/);
  });
  test("no header, no list", () => {
    expect(() => parseEuringList([run(1, 24, 624, "Arial-BoldMT", "Quail ")])).toThrow(/no table header/);
  });
  test("runs in any stream order give the same records", () => {
    const runs = [
      ...header,
      run(1, 24, 624, "Arial-BoldMT", "Quail "), run(1, 199, 624, "ArialMT", "Israel"), run(1, 261, 624, "ArialMT", "ILT"),
      run(1, 303, 624, "ArialMT", "C 7154"), run(1, 359, 624, "ArialMT", "12y 1m"), run(1, 449, 624, "ArialMT", "Found dead"),
      run(1, 24, 610.8, "Arial-ItalicMT", "Coturnix coturnix"), run(1, 199, 610.7, "ArialMT", "Spain"), run(1, 261, 610.7, "ArialMT", "ESI"),
      run(1, 303, 610.7, "ArialMT", "3303820"), run(1, 359, 610.7, "ArialMT", "11y im"), run(1, 463, 610.7, "ArialMT", "Shot"),
    ];
    const a = parseEuringList(runs);
    expect(parseEuringList([...runs].reverse())).toEqual(a);
    expect(a.map((r) => [r.scientificName, r.rank, r.country, r.ringNo, r.valueYears])).toEqual([
      ["Coturnix coturnix", 1, "Israel", "C 7154", 12 + 1 / 12],
      ["Coturnix coturnix", 2, "Spain", "3303820", 11],
    ]);
  });
});

describe("EURING precedence", () => {
  const obs = (source: "EURING" | "USGS_BBL", valueYears: number): MatchedObservation => ({
    source, sourceVersion: "", sourceRecordId: `${source}:${valueYears}`, sourceName: "Coturnix coturnix", sourceCommonName: null,
    valueYears, recordType: "wild", quality: "acceptable", sampleSizeText: null, sex: null, detail: null, reference: null,
    license: "", speccode: null, aquatic: null, speciesTaxid: 93934, matchMethod: "ncbi_scientific_name",
  });
  test("EURING outranks USGS for a bird even when USGS has the larger value; its larger record wins", () => {
    const chosen = chooseLifespan([obs("USGS_BBL", 15), obs("EURING", 11), obs("EURING", 12.5)], "bird");
    expect([chosen?.source, chosen?.valueYears]).toEqual(["EURING", 12.5]);
    expect(chooseLifespan([obs("USGS_BBL", 15), obs("EURING", 11)], "fish")).toBeNull();
  });
});

describe.skipIf(!existsSync(cacheFile(EURING)))("the pinned EURING list", async () => {
  const bytes = new Uint8Array(await Bun.file(cacheFile(EURING)).arrayBuffer());
  const runs = pdfTextRuns(bytes);
  const records = parseEuringList(runs);
  test("its title names the list's date", () => {
    expect(runs.some((r) => r.text === "European Longevity Records - 2023-09-01")).toBe(true);
  });
  test("every age cell of the PDF becomes exactly one record", () => {
    const ageCells = runs.filter((r) => r.font === "ArialMT" && /^\s*\d+\s*y\s*\S+\s*$/.test(r.text)).map((r) => r.text.replace(/\s+/g, " ").trim()).sort();
    expect(records.map((r) => r.ageText).sort()).toEqual(ageCells);
  });
  test("one oldest record per species, the second never older, both from one name", () => {
    const bySpecies = Map.groupBy(records, (r) => r.scientificName);
    expect([...bySpecies.values()].every((g) => g.filter((r) => r.rank === 1).length === 1 && g.length <= 2)).toBe(true);
    for (const g of bySpecies.values()) {
      const [first, second] = [g.find((r) => r.rank === 1)!, g.find((r) => r.rank === 2)];
      if (second) expect(second.valueYears!).toBeLessThanOrEqual(first.valueYears!);
      expect(new Set(g.map((r) => r.commonName)).size).toBe(1);
    }
    expect(records.filter((r) => r.rank === 1).length).toBe(bySpecies.size);
  });
  test("the upright scientific name (White Stork) and the unreadable month (quail) are kept", () => {
    expect(records.filter((r) => r.scientificName === "Ciconia ciconia").map((r) => r.commonName)).toEqual(["White Stork", "White Stork"]);
    const quail = records.find((r) => r.ringNo === "3303820")!;
    expect([quail.scientificName, quail.valueYears, quail.ageNote !== null]).toEqual(["Coturnix coturnix", 11, true]);
  });
  test("observations carry the pinned version and unique record ids", async () => {
    const obs = await loadEuring();
    expect(obs.length).toBe(records.length);
    expect(new Set(obs.map((o) => o.sourceRecordId)).size).toBe(obs.length);
    expect(new Set(obs.map((o) => o.sourceVersion))).toEqual(new Set([EURING.version]));
  });
});
