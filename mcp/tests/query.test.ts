/**
 * The server's queries, against a database built here by the same writer `bun run sqlite` uses,
 * from the committed parquet. The species, regions, structures and lifespan observations are the
 * build's own rows, and every expected value is computed from them at run time.
 *
 * The correlation rows are written for this file, because the published ones are derived during the
 * site build and are not committed. Their values are chosen to cover what a verdict has to tell
 * apart: a control that holds, one that fails, one that is significant with the opposite sign, and
 * one that was never computed.
 */
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readParquet, type Row as ParquetRow } from "../../pipeline/lib/parquet";
import { writeBuildInfo, writeTable } from "../../pipeline/sqlite";
import type { BuildInfo } from "../../src/data/schema";
import { resolveDatabase } from "../src/db.js";
import {
  buildFacts,
  correlation,
  rankFeatures,
  regionSummary,
  runQuery,
  scopeFilter,
  searchSpecies,
  speciesProfile,
} from "../src/query.js";

const ROOT = join(import.meta.dir, "..", "..");
const DATA = join(ROOT, "public", "data");
const BUILD_INFO = JSON.parse(readFileSync(join(ROOT, "src", "data", "generated", "build-info.json"), "utf8")) as BuildInfo;

/** feature_key, scope, n, pearson_r, p_value, q_value, partial_r, partial_p, pic_r, pic_p. */
const FIXTURE_CORRELATIONS: [string, string, number, number, number, number, number | null, number | null, number | null, number | null][] = [
  // Passes every control.
  ["gc:total_mtDNA", "all", 2202, 0.4, 1e-30, 1e-29, 0.3, 1e-10, 0.25, 1e-8],
  // Passes the false discovery rate, does not hold on contrasts.
  ["gcSkew:total_mtDNA", "all", 2202, -0.3, 1e-20, 1e-19, -0.2, 1e-6, -0.01, 0.9],
  // Significant on contrasts, with the opposite sign: not a survival.
  ["size:total_mtDNA", "all", 2202, 0.2, 1e-10, 1e-9, 0.1, 0.01, -0.15, 1e-4],
  // Does not pass the false discovery rate.
  ["atSkew:total_mtDNA", "all", 2202, 0.02, 0.3, 0.4, 0.01, 0.6, 0.01, 0.7],
  // The body-mass control is significant with the opposite sign: passed, as Table 3 counts it, and
  // the summary has to say which way the partial correlation points.
  ["ff:ND2:U", "all", 2202, 0.3, 1e-15, 1e-14, -0.25, 1e-7, 0.2, 1e-5],
  // Neither control was computed for this row.
  ["gc:COX1", "class:Mammalia", 612, 0.35, 1e-12, 1e-11, null, null, null, null],
];

const parquet = new Map<string, ParquetRow[]>();
const rowsOf = (file: string): ParquetRow[] => {
  const got = parquet.get(file);
  if (got === undefined) throw new Error(`${file} was not read`);
  return got;
};

for (const file of ["species.parquet", "region_stats.parquet", "mtdna_structure.parquet", "lifespan_observations.parquet"]) {
  parquet.set(file, await readParquet(join(DATA, file)));
}

const species = rowsOf("species.parquet");
const regions = rowsOf("region_stats.parquet");

const db = ((): DatabaseSync => {
  const made = new DatabaseSync(join(mkdtempSync(join(tmpdir(), "mitoage-mcp-")), "fixture.sqlite"));
  const nonFinite = new Map<string, number>();
  writeTable(made, "species", species, nonFinite);
  writeTable(made, "region_stats", regions, nonFinite);
  writeTable(made, "mtdna_structure", rowsOf("mtdna_structure.parquet"), nonFinite);
  writeTable(made, "lifespan_observations", rowsOf("lifespan_observations.parquet"), nonFinite);
  writeTable(
    made,
    "correlations",
    FIXTURE_CORRELATIONS.map(([feature_key, scope, n, pearson_r, p_value, q_value, partial_r, partial_p_value, pic_r, pic_p_value]) => ({
      build: 2,
      dataset: "default",
      filters: "record_status != retired",
      lifespan_sources: "AnAge",
      feature_key,
      trait: "maxLongevityYears",
      scope,
      n,
      pearson_r,
      spearman_rho: pearson_r,
      p_value,
      q_value,
      partial_r,
      partial_p_value,
      partial_n: partial_r === null ? null : n,
      pic_r,
      pic_p_value,
    })),
    nonFinite,
  );
  writeBuildInfo(made, BUILD_INFO, "2026-01-01T00:00:00.000Z");
  expect([...nonFinite]).toEqual([]);
  return made;
})();

test('a scope is "all" or a rank and a name, and an unknown rank is refused', () => {
  expect(scopeFilter("all")).toEqual({ sql: "1 = 1", params: [] });
  expect(scopeFilter("class:Mammalia")).toEqual({ sql: 's."class" = ?', params: ["Mammalia"] });
  expect(() => scopeFilter("kingdom:Animalia")).toThrow(/rank must be one of/);
  expect(() => scopeFilter("Mammalia")).toThrow(/write "all"/);
});

test("a name search returns matching species, longest-lived first, and a scope keeps that scope's species", () => {
  const hits = searchSpecies(db, { query: "whale", limit: 50 });
  expect(hits.length).toBeGreaterThan(0);
  for (const h of hits) {
    const names = [h["scientific_name"], h["common_name"], h["slug"]].map((v) => String(v ?? "").toLowerCase());
    expect(names.some((n) => n.includes("whale"))).toBe(true);
  }
  const lifespans = hits.map((h) => h["max_longevity_years"]).filter((v): v is number => typeof v === "number");
  expect(lifespans).toEqual([...lifespans].sort((a, b) => b - a));

  const mammals = searchSpecies(db, { scope: "class:Mammalia", limit: 10 });
  expect(mammals.length).toBe(10);
  expect([...new Set(mammals.map((m) => m["class"]))]).toEqual(["Mammalia"]);
  const longest = species
    .filter((s) => s["class"] === "Mammalia" && typeof s["max_longevity_years"] === "number")
    .sort((a, b) => (b["max_longevity_years"] as number) - (a["max_longevity_years"] as number))[0];
  expect(mammals[0]!["scientific_name"]).toBe(longest!["scientific_name"] as string);
});

test("a species is found by slug and by scientific name, and carries its own regions", () => {
  const some = species.find((s) => typeof s["common_name"] === "string" && s["common_name"] !== "")!;
  const bySlug = speciesProfile(db, String(some["slug"]));
  const byName = speciesProfile(db, String(some["scientific_name"]).toUpperCase());
  expect(byName.species["id"]).toBe(bySlug.species["id"]);
  const expected = regions
    .filter((r) => r["species_id"] === some["id"])
    .map((r) => String(r["region"]))
    .sort();
  expect(bySlug.regions.map((r) => String(r["region"]))).toEqual(expected);
  expect(bySlug.retired).toBe(some["record_status"] === "retired");
});

test("a species that is not in the build is refused", () => {
  expect(() => speciesProfile(db, "Balaena mysticetuss")).toThrow(/no species/);
});

test("a verdict tells apart a control that holds, one that fails, one with the opposite sign and one never computed", () => {
  expect(correlation(db, { featureKey: "gc:total_mtDNA" }).verdict).toMatchObject({
    fdrSignificant: true,
    survivesPhylogeny: true,
    survivesBodyMass: true,
  });
  expect(correlation(db, { featureKey: "gcSkew:total_mtDNA" }).verdict).toMatchObject({ fdrSignificant: true, survivesPhylogeny: false });

  const flipped = correlation(db, { featureKey: "size:total_mtDNA" });
  expect(flipped.correlation["pic_p_value"] as number).toBeLessThan(0.05);
  expect(flipped.verdict.survivesPhylogeny).toBe(false);

  expect(correlation(db, { featureKey: "atSkew:total_mtDNA" }).verdict.fdrSignificant).toBe(false);

  // Table 3 passes the body-mass control on its p-value; the opposite sign is said, not hidden.
  const opposite = correlation(db, { featureKey: "ff:ND2:U" });
  expect(opposite.verdict.survivesBodyMass).toBe(true);
  expect(opposite.verdict.summary).toContain("opposite sign");

  const notAssessed = correlation(db, { featureKey: "gc:COX1", scope: "class:Mammalia" });
  expect(notAssessed.verdict).toMatchObject({ fdrSignificant: true, survivesPhylogeny: null, survivesBodyMass: null });
  expect(notAssessed.verdict.summary).toContain("not assessed");
});

test("a missing correlation is refused with the scopes the feature does have", () => {
  expect(() => correlation(db, { featureKey: "gc:COX1", scope: "all" })).toThrow(/class:Mammalia/);
});

test("the ranking is by the size of r, and only_surviving keeps exactly the rows that pass both", () => {
  const ranked = rankFeatures(db, { scope: "all" });
  const byAbs = FIXTURE_CORRELATIONS.filter((c) => c[1] === "all")
    // The ranking's tiebreak is the feature key, compared byte by byte as SQLite compares it.
    .sort((a, b) => Math.abs(b[3]) - Math.abs(a[3]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map((c) => c[0]);
  expect(ranked.features.map((f) => String(f.correlation["feature_key"]))).toEqual(byAbs);
  expect(ranked.assessed).toBe(byAbs.length);

  const surviving = rankFeatures(db, { scope: "all", onlySurviving: true });
  const expected = ranked.features
    .filter((f) => f.verdict.fdrSignificant === true && f.verdict.survivesPhylogeny === true)
    .map((f) => String(f.correlation["feature_key"]));
  expect(surviving.features.map((f) => String(f.correlation["feature_key"]))).toEqual(expected);
  expect(expected).toEqual(["gc:total_mtDNA", "ff:ND2:U"]);
});

test("a region summary counts and averages the published rows of its scope", () => {
  const summary = regionSummary(db, { scope: "class:Mammalia", region: "total_mtDNA" });
  expect(summary.regions.length).toBe(1);
  const mammals = new Set(species.filter((s) => s["class"] === "Mammalia").map((s) => s["id"]));
  const mine = regions.filter((r) => r["region"] === "total_mtDNA" && mammals.has(r["species_id"]));
  const gc = mine.map((r) => r["gc_percent"]).filter((v): v is number => typeof v === "number");
  expect(summary.regions[0]!["rows"]).toBe(mine.length);
  expect(summary.regions[0]!["gc_percent_n"]).toBe(gc.length);
  expect(summary.regions[0]!["gc_percent_mean"] as number).toBeCloseTo(gc.reduce((a, b) => a + b, 0) / gc.length, 9);
  expect(summary.computed).toContain("published region_stats rows");
});

test("the query tool runs one read-only statement and says when it cut the rows", () => {
  const got = runQuery(db, 'SELECT "slug" FROM "species" ORDER BY "slug"', 5);
  expect(got.rows.length).toBe(5);
  expect(got.truncated).toBe(true);
  expect(got.rows.map((r) => String(r["slug"]))).toEqual(
    species
      .map((s) => String(s["slug"]))
      .sort()
      .slice(0, 5),
  );

  expect(() => runQuery(db, 'DELETE FROM "species"')).toThrow(/read-only/);
  expect(() => runQuery(db, "SELECT 1; SELECT 2")).toThrow(/one statement/);
  expect(() => runQuery(db, "   ")).toThrow(/empty/);
  // A trailing semicolon is a typing habit, not a second statement.
  expect(runQuery(db, "SELECT 1 AS one;").rows).toEqual([{ one: 1 }]);
});

test("build_info names the build and counts every table the database holds", () => {
  const facts = buildFacts(db);
  expect(facts.build).toBe(BUILD_INFO.build);
  expect(facts.tables.find((t) => t.table === "species")!.rows).toBe(species.length);
  expect(facts.tables.find((t) => t.table === "region_stats")!.rows).toBe(regions.length);
  expect(facts.sources.length).toBe((BUILD_INFO.sources ?? []).length);
});

test("without a pin and without MITOAGE_DB the server refuses, and says what to set", async () => {
  const pin = { repo: "longevity-genie/mitoage", revision: null, file: "mitoage.sqlite", sha256: null, build: null };
  await expect(resolveDatabase(pin, {} as NodeJS.ProcessEnv)).rejects.toThrow(/not pinned to a dataset revision/);
  await expect(resolveDatabase(pin, { MITOAGE_DB: "/nowhere/mitoage.sqlite" } as NodeJS.ProcessEnv)).rejects.toThrow(/there is no file there/);
});
