import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { readParquet } from "../../pipeline/lib/parquet";
import { classDiscordance, groupKey, groupSummaries, joinProteins, median, readDiscordance } from "./mitoport";

const DIR = join(import.meta.dir, "..", "..", "public", "data", "mitoport");
const read = (f: string) => readParquet(join(DIR, f));
const [erc, coembed, coupling, species] = await Promise.all(["erc.parquet", "coembed.parquet", "iface/coupling.parquet", "partners_species.parquet"].map(read));

describe("proteins joined by gene", () => {
  const rows = joinProteins(erc!, coembed!, coupling!);

  test("one row per gene of any table, and each value is its own table's value for that gene", () => {
    const genes = new Set([...erc!, ...coembed!, ...coupling!].map((r) => r["gene"]));
    expect(rows.map((r) => r.gene).sort()).toEqual([...genes].map(String).sort());
    const by = new Map(rows.map((r) => [r.gene, r]));
    for (const e of erc!) {
      const r = by.get(String(e["gene"]))!;
      expect([r.ercIV, r.ercIII, r.inErc]).toEqual([e["B_complex_IV"] as number, e["B_complex_III"] as number, true]);
    }
    for (const c of coembed!) expect(by.get(String(c["gene"]))!.coembedIV).toBe(c["IV"] as number);
    for (const k of coupling!) {
      const r = by.get(String(k["gene"]))!;
      expect([r.seqContact, r.seqExcessMt, r.esmExcessMt]).toEqual([k["seq_contact_iface"] ?? null, k["seq_excess_mt"] ?? null, k["esm_excess_mt"] ?? null] as (number | null)[]);
    }
    // A protein missing from erc has no rate, not a rate of zero.
    const absent = rows.filter((r) => !r.inErc);
    expect(absent.length).toBe(genes.size - erc!.length);
    expect(absent.every((r) => r.ercIV === null && r.ercIII === null)).toBe(true);
  });

  test("complex IV's subunits are one group though coupling.tsv calls them partners", () => {
    expect(coupling!.some((r) => r["group"] === "complex IV partner")).toBe(true);
    expect(rows.filter((r) => r.group === "complex IV nuclear").length).toBe(coupling!.filter((r) => groupKey(String(r["group"])) === "complex IV nuclear").length);
    expect(rows.some((r) => r.group === "complex IV partner")).toBe(false);
  });

  test("a gene in two groups, or twice in one table, stops the join", () => {
    const moved = erc!.map((r, i) => (i === 0 ? { ...r, group: "cytosolic control" } : r));
    expect(() => joinProteins(moved, coembed!, coupling!)).toThrow(/different groups/);
    expect(() => joinProteins([...erc!, erc![0]!], coembed!, coupling!)).toThrow(/twice/);
  });

  // The medians the hypotheses record reports (mitoage-pipelines docs/HYPOTHESES.md, H5), from the tables here.
  test("group medians reproduce H5's published contrasts", () => {
    const g = new Map(groupSummaries(rows).map((s) => [s.group, s]));
    const iv = g.get("complex IV nuclear")!.medians;
    const ctl = g.get("cytosolic control")!.medians;
    expect([iv.seqContact.median, ctl.seqContact.median].map((v) => Math.round(v! * 100) / 100)).toEqual([0.58, 0.03]);
    expect([iv.seqExcessMt.median, ctl.seqExcessMt.median].map((v) => Math.round(v! * 1000) / 1000)).toEqual([0.049, 0.016]);
    expect(g.get("complex IV nuclear")!.proteins).toBe(11);
  });

  test("median of none is unknown, and of an even count is the mean of the middle two", () => {
    expect(median([null, null])).toEqual({ n: 0, median: null });
    expect(median([4, null, 1, 3, 2])).toEqual({ n: 4, median: 2.5 });
    expect(median([5])).toEqual({ n: 1, median: 5 });
  });
});

describe("discordance per species", () => {
  const rows = readDiscordance(species!);

  test("class means over the scored species reproduce H12's published means and counts", () => {
    const c = new Map(classDiscordance(rows).map((x) => [x.class, x]));
    const r3 = (v: number | null) => Math.round(v! * 1000) / 1000;
    expect(["Mammalia", "Aves", "Actinopterygii"].map((k) => [k, c.get(k)!.scored, r3(c.get(k)!.meanContact), r3(c.get(k)!.meanControl)])).toEqual([
      ["Mammalia", 177, 0.135, 0.135],
      ["Aves", 78, 0.101, 0.108],
      ["Actinopterygii", 41, 0.116, 0.102],
    ]);
    expect(c.get("Actinopterygii")!.species).toBe(61);
  });

  test("an unscored species keeps its pair counts and has no discordance, not zero", () => {
    const unscored = rows.filter((r) => r.contact === null);
    expect(unscored.length).toBe(species!.filter((r) => r["contact"] === null || r["contact"] === undefined).length);
    expect(unscored.length).toBeGreaterThan(0);
    expect(unscored.every((r) => r.contactMinusControl === null && r.contactPairs > 0)).toBe(true);
  });

  test("contact minus control is the difference of the two shares wherever both are scored", () => {
    // The source prints five significant digits, so each share is off by at most 5e-6 and the difference by 1e-5.
    for (const r of rows.filter((x) => x.contact !== null && x.control !== null)) {
      expect(Math.abs(r.contactMinusControl! - (r.contact! - r.control!))).toBeLessThanOrEqual(1e-5 + 1e-12);
    }
  });

  test("a species listed twice, or without its pair counts, is refused", () => {
    expect(() => readDiscordance([...species!, species![0]!])).toThrow(/twice/);
    expect(() => readDiscordance([{ ...species![0]!, contact_pairs: null }])).toThrow(/no contact_pairs/);
  });
});
