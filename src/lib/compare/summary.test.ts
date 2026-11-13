import { describe, expect, test } from "bun:test";
import { getAllSpecies } from "~/data";
import { groupStats, regionValues, statsGroups, taxonomyFile } from "./build";
import { paramValue } from "./params";
import { packRows, regionRows, taxaRows, unpackRows } from "./rows";
import { coefVar, lifespanCorrelation, summarize } from "./summary";

describe("summarize", () => {
  test("n, mean, sample SD, median, extremes; skips missing values", () => {
    const s = summarize([4, null, 1, 3, Number.NaN, 2]);
    expect(s.n).toBe(4);
    expect(s.mean).toBe(2.5);
    expect(s.sd).toBeCloseTo(1.290994, 6);
    expect(s.median).toBe(2.5);
    expect([s.min, s.minAt, s.max, s.maxAt]).toEqual([1, 2, 4, 0]);
    expect(coefVar(s)).toBeCloseTo(0.516398, 6);
    expect(summarize([7]).sd).toBeNaN();
    expect(summarize([]).n).toBe(0);
  });

  test("correlation with log10 lifespan needs 5 species", () => {
    expect(lifespanCorrelation([1, 2, 3, 4], [10, 100, 1000, 10000]).r).toBeNaN();
    const c = lifespanCorrelation([1, 2, 3, 4, 5], [10, 100, 1000, 10000, 100000]);
    expect(c.r).toBeCloseTo(1, 10);
    expect(c.n).toBe(5);
  });
});

describe("parameters", () => {
  test("base percentages are over A + C + G + T", () => {
    const r = { lengthBp: 100, a: 30, c: 20, g: 10, t: 40, gcSkew: -1 / 3, atSkew: -1 / 7 };
    expect(paramValue(r, "gc")).toBe(30);
    expect(paramValue(r, "at")).toBe(70);
    expect(paramValue(r, "a")).toBe(30);
    expect(paramValue(r, "gcSkew")).toBeCloseTo(-0.3333, 4);
    expect(paramValue(r, "length")).toBe(100);
  });
});

describe("group tables", () => {
  const all = statsGroups()[0]!;

  test("groups: all species, then classes, orders and families with 3 or more species", () => {
    const gs = statsGroups();
    expect(all.key).toBe("all");
    expect(all.members.length).toBe(getAllSpecies().length);
    expect(gs.every((g) => g.rank === "all" || g.members.length >= 3)).toBe(true);
    expect(gs.some((g) => g.key === "class-mammalia")).toBe(true);
  });

  test("whole-genome GC of all species matches the per-species values", () => {
    const file = groupStats(all);
    const gc = file.stats.total_mtDNA?.gc;
    const direct = summarize(getAllSpecies().map((s) => s.gcPercent));
    expect(gc?.[0]).toBe(direct.n);
    expect(gc?.[1]).toBeCloseTo(direct.mean, 3);
    expect(gc?.[3]).toBeCloseTo(direct.min, 3);
    expect(gc?.[6]).toBeCloseTo(direct.max, 3);
    const rows = regionRows(file, "gc");
    expect(rows.length).toBe(20);
    expect(rows[0]?.label).toBe("Whole genome");
  });

  test("class rows add up to all species", () => {
    const rows = taxaRows(taxonomyFile(), regionValues("total_mtDNA"), { rank: "all", name: "" }, "class", "gc");
    const n = rows.reduce((s, r) => s + (r.n as number), 0);
    expect(n).toBe(regionValues("total_mtDNA").species.length);
    const mammals = rows.find((r) => r.name === "Mammalia");
    expect(mammals?.href).toContain("/compare/class/mammalia/");
  });

  test("packed rows round-trip", () => {
    const rows = regionRows(groupStats(all), "gcSkew");
    const back = unpackRows(packRows(rows));
    expect(back.length).toBe(rows.length);
    expect(back[3]?.label).toBe(rows[3]?.label);
    expect(back[3]?.mean as number).toBeCloseTo(rows[3]?.mean as number, 5);
  });
});
