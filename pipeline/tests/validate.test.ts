import { describe, expect, test } from "bun:test";
import type { RowProvenance, Species } from "../../src/data/schema";
import { type ChangelogRow, checkLifespans, checkProvenance } from "../validate";

const prov = (recordStatus: RowProvenance["recordStatus"], addedInBuild = 1, modified = false): RowProvenance => ({
  addedInBuild, addedAt: addedInBuild === 1 ? "2015-07-01T00:00:00.000Z" : "2026-11-13T00:00:00.000Z",
  lastModifiedBuild: modified ? 2 : null, lastModifiedAt: modified ? "2026-11-13T00:00:00.000Z" : null, recordStatus, sourceVersion: "NC_1.1",
});
const sp = (id: number, p: RowProvenance, extra: Partial<Species> = {}): Species => ({
  id, slug: `s-${id}`, refseq: "NC_1.1", scientificName: `Genus s${id}`, commonName: "", maxLongevityYears: 10, mtdnaSizeBp: 16000,
  nonCodingBp: 0, gcPercent: 40, legacyId: null,
  taxonomy: { kingdom: "Animalia", phylum: "Chordata", class: "Actinopterygii", order: "", family: "", genus: "Genus" },
  traits: { adultWeightG: null, birthWeightG: null, metabolicRateW: null, bodyTemperatureK: null, femaleMaturityDays: null, maleMaturityDays: null, gestationDays: null, litterSize: null, littersPerYear: null, growthRatePerDay: null, source: null },
  provenance: p, ...extra,
});
const cl = (table: string, rowKey: string, field: string, changeType: string, oldValue: string | null = "a", newValue: string | null = "b"): ChangelogRow => ({ table, rowKey, field, oldValue, newValue, changeType, scope: "row" });
const child = (key: string, speciesId: number, status: string, addedInBuild = 1, lastModifiedBuild: number | null = null) => ({ table: "region_stats", key, speciesId, status, addedInBuild, lastModifiedBuild });

describe("row metadata against the changelog", () => {
  test("a consistent set passes", () => {
    const species = [
      sp(1, prov("original")),
      sp(2, prov("updated", 1, true)),
      sp(3, prov("retired", 1, true), { retiredReason: "gone" }),
      sp(4, prov("renamed", 1, true), { previousScientificNames: ["Old name"] }),
      sp(10000005, prov("new", 2)),
    ];
    const changelog = [
      cl("species", "2", "max_longevity_years", "value_update"),
      cl("region_stats", "2:ND3", "length_bp", "correction"),
      cl("species", "3", "record_status", "retired", "original", "retired"),
      cl("species", "4", "scientific_name", "renamed"),
      cl("species", "10000005", "(row)", "added", null, "x"),
      cl("region_stats", "10000005:*", "(rows)", "added", null, "1 rows"),
      cl("region_stats", "2:D_Loop", "(row)", "correction", null, "length_bp=1"),
    ];
    const children = [
      child("1:ND3", 1, "original"),
      child("2:ND3", 2, "updated", 1, 2),
      child("2:D_Loop", 2, "new", 2),
      child("3:ND3", 3, "retired"),
      child("10000005:ND3", 10000005, "new", 2),
    ];
    expect(checkProvenance(species, children, changelog)).toEqual([]);
  });
  test("each disagreement is reported", () => {
    const p = checkProvenance(
      [sp(1, prov("original")), sp(2, prov("new", 2)), sp(3, prov("retired", 1, true))],
      [child("1:ND3", 1, "original"), child("1:ND4", 1, "original"), child("2:ND3", 2, "new", 2)],
      [cl("region_stats", "1:ND4", "a", "correction"), cl("species", "9", "x", "value_update")],
    );
    const text = p.join("\n");
    expect(text).toContain("s-1: original but 1 changelog rows");
    expect(text).toContain("s-2: record_status new but changelog does not add it");
    expect(text).toContain("s-3: record_status retired but changelog does not retire it");
    expect(text).toContain("region_stats 1:ND4: record_status original, changelog implies updated");
    expect(text).toContain("row of a new species without a changelog '(rows)' entry");
    expect(text).toContain("changelog row species:9 does not refer to an existing row");
  });
});

describe("lifespan rules", () => {
  const life = (source: "AnAge" | "FishBase" | "USGS_BBL") => ({ source, sourceVersion: "v", sourceRecordId: "r", quality: "acceptable" as const, sampleSize: null, recordType: "wild" as const, license: "lic" });
  const obs = (id: number, source: string, value: number, chosen: boolean) => ({ species_id: id, source, value_years: value, is_chosen: chosen, license: "lic", source_record_id: "r" });
  test("AnAge first, allowed source, one chosen value equal to the species value", () => {
    const fish = sp(1, prov("original"), { lifespan: life("FishBase"), maxLongevityYears: 10 });
    expect(checkLifespans([fish], [obs(1, "FishBase", 10, true)])).toEqual([]);
    expect(checkLifespans([fish], [obs(1, "FishBase", 10, true), obs(1, "AnAge", 8, false)]).join()).toContain("AnAge has a value but FishBase was chosen");
    const mammal = sp(2, prov("original"), { lifespan: life("FishBase"), taxonomy: { ...fish.taxonomy, class: "Mammalia" } });
    expect(checkLifespans([mammal], [obs(2, "FishBase", 10, true)]).join()).toContain("FishBase is not a lifespan source for other_vertebrate");
    expect(checkLifespans([fish], [obs(1, "FishBase", 10, true), obs(1, "FishBase", 12, true)]).join()).toContain("2 chosen");
    expect(checkLifespans([fish], [obs(1, "FishBase", 11, true)]).join()).toContain("!= species");
    expect(checkLifespans([sp(3, prov("original"), { lifespan: { ...life("AnAge"), license: "" } })], [obs(3, "AnAge", 10, true)]).join()).toContain("no lifespan licence");
  });
});
