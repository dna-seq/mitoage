import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isMitoport } from "../hf";
import type { MitoportManifest } from "../mitoport";
import { readParquet } from "../lib/parquet";
import { MITOPORT_FILES, MITOPORT_REVISION } from "../sources/mitoport";
import { columnType, convert, firstDifference, lifespanNull, listColumn, parquetName, tsvColumns, verifySha256 } from "../steps/mitoport";

const ROOT = join(import.meta.dir, "..", "..");
const OUT = join(ROOT, "public", "data", "mitoport");
const CACHE = join(ROOT, "data", "cache", "mitoport", MITOPORT_REVISION);
const manifest = JSON.parse(readFileSync(join(OUT, "mitoport.json"), "utf8")) as MitoportManifest;

describe("pinning", () => {
  test("a file is accepted only with its pinned SHA-256", () => {
    const bytes = new TextEncoder().encode("gene\tB\nCOX4I1\t0.265\n");
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(verifySha256(bytes, sha, "x")).toBe(sha);
    const changed = bytes.slice();
    changed[changed.length - 2] = "4".charCodeAt(0);
    expect(() => verifySha256(changed, sha, "x")).toThrow(/is not the pinned/);
  });

  test("the committed manifest names the pinned revision and, file for file, the pinned hashes", () => {
    expect(manifest.revision).toBe(MITOPORT_REVISION);
    expect(manifest.files.map((f) => [f.source, f.file, f.sha256])).toEqual(
      MITOPORT_FILES.map((f) => [`output/mitoport/${f.path}`, parquetName(f.path), f.sha256]),
    );
  });
});

describe("TSV to parquet", () => {
  test("columns are typed by every cell; an empty cell is null, never zero", () => {
    const t = tsvColumns("gene\tn\tr\tnote\nA\t3\t0.5\tx\nB\t12\t\t\nC\t-1\t-2e-3\t7\n", "t");
    expect(t.columns.map((c) => [c.name, c.type])).toEqual([["gene", "STRING"], ["n", "INT32"], ["r", "DOUBLE"], ["note", "STRING"]]);
    expect(t.columns[2]!.data).toEqual([0.5, null, -0.002]);
    expect(t.columns[3]!.data).toEqual(["x", null, "7"]);
    expect(columnType(["", ""])).toBe("STRING");
    expect(columnType(["1", "3000000000"])).toBe("DOUBLE");
    expect(columnType(["1", "1.5"])).toBe("DOUBLE");
    expect(columnType(["0.1", "NaN"])).toBe("STRING");
  });

  test("a header with spaces gets underscores, and the renaming is recorded", () => {
    const t = tsvColumns("slug\tcontact minus control\na\t0.1\n", "t");
    expect(t.columns.map((c) => c.name)).toEqual(["slug", "contact_minus_control"]);
    expect(t.renamed).toEqual({ "contact minus control": "contact_minus_control" });
  });

  test("a ragged row, a repeated or empty header, or no rows is refused", () => {
    expect(() => tsvColumns("a\tb\n1\n", "t")).toThrow(/row 2 has 1 fields/);
    expect(() => tsvColumns("a\ta b\ta_b\n1\t2\t3\n", "t")).toThrow(/a_b appears twice/);
    expect(() => tsvColumns("a\t\n1\t2\n", "t")).toThrow(/empty column name/);
    expect(() => tsvColumns("a\tb\n", "t")).toThrow(/no rows/);
    expect(() => listColumn("x\n\ny\n", "slug", "t")).toThrow(/blank/);
    expect(() => listColumn("x\nx\n", "slug", "t")).toThrow(/twice/);
    expect(() => convert("a.csv", "a\n1\n")).toThrow(/no conversion/);
  });

  test("a read-back that differs from what was written is found", () => {
    const t = tsvColumns("g\tr\nA\t\nB\t0.25\n", "t");
    expect(firstDifference(t, [{ g: "A", r: null }, { g: "B", r: 0.25 }])).toBeNull();
    expect(firstDifference(t, [{ g: "A", r: 0 }, { g: "B", r: 0.25 }])).toMatch(/column r, row 1/);
    expect(firstDifference(t, [{ g: "A", r: null }])).toMatch(/1 rows read back/);
  });

  // The pinned sources are in the download cache (not in git) once `bun run mitoport` has run.
  test.skipIf(!existsSync(CACHE))("every committed parquet holds its pinned source's values, cell for cell", async () => {
    for (const f of MITOPORT_FILES) {
      const bytes = new Uint8Array(readFileSync(join(CACHE, f.path)));
      verifySha256(bytes, f.sha256, f.path);
      const text = new TextDecoder().decode(bytes);
      const table = convert(f.path, text);
      const back = await readParquet(join(OUT, parquetName(f.path)));
      expect([f.path, firstDifference(table, back)]).toEqual([f.path, null]);
      // And independently of the converter: every non-empty source cell reads back as the same text or number.
      if (f.path.endsWith(".tsv")) {
        const [head, ...rows] = text.trimEnd().split("\n").map((l) => l.split("\t"));
        rows.forEach((cells, i) =>
          cells.forEach((cell, j) => {
            const got = back[i]![head![j]!.replace(/\s+/g, "_")];
            if (cell === "") expect(got).toBeNull();
            else expect(typeof got === "number" ? got === Number(cell) : got === cell).toBe(true);
          }),
        );
      }
    }
  });
});

describe("the lifespan claim", () => {
  const partners = () => readParquet(join(OUT, "partners.parquet"));
  const lifespan = () => readParquet(join(OUT, "iface", "lifespan.parquet"));

  test("holds on the published tables, with the reptiles counted as not assessed", async () => {
    const p = await partners();
    const l = await lifespan();
    const v = lifespanNull(p, l);
    expect(v.failures).toEqual([]);
    expect(v.holds).toBe(true);
    expect(v.testedFits).toBe(p.filter((r) => r["status"] === "tested").length);
    expect(v.smallestQ).toBe(Math.min(...p.filter((r) => r["status"] === "tested").map((r) => r["q"] as number)));
    expect(v.notAssessed.map((x) => x.class)).toEqual(["Reptilia"]);
    expect(v.intervals).toBe(l.length);
  });

  test("fails on one q under 0.05, a missing q, an interval off zero, a missing interval, or an unknown status", async () => {
    const p = await partners();
    const l = await lifespan();
    const i = p.findIndex((r) => r["status"] === "tested");
    const withQ = (q: unknown) => p.map((r, j) => (j === i ? { ...r, q } : r));
    expect(lifespanNull(withQ(0.049), l).holds).toBe(false);
    expect(lifespanNull(withQ(null), l).failures[0]).toMatch(/no q/);
    expect(lifespanNull(p, l.map((r, j) => (j === 0 ? { ...r, ci95_low: 0.001, ci95_high: 0.05 } : r))).holds).toBe(false);
    expect(lifespanNull(p, l.map((r, j) => (j === 0 ? { ...r, ci95_high: -0.001 } : r))).holds).toBe(false);
    expect(lifespanNull(p, l.map((r, j) => (j === 0 ? { ...r, ci95_low: null } : r))).failures[0]).toMatch(/no interval/);
    expect(lifespanNull(p.map((r, j) => (j === i ? { ...r, status: "failed: singular" } : r)), l).holds).toBe(false);
    expect(lifespanNull([], l).holds).toBe(false);
    expect(lifespanNull(p, []).holds).toBe(false);
  });
});

test("the Hugging Face package leaves out public/data/mitoport/ and nothing else", () => {
  const DATA = join(ROOT, "public", "data");
  expect(isMitoport(join(DATA, "mitoport"))).toBe(true);
  expect(isMitoport(join(DATA, "mitoport", "iface", "coupling.parquet"))).toBe(true);
  expect(isMitoport(join(DATA, "species.parquet"))).toBe(false);
  expect(isMitoport(join(DATA, "mitoport.parquet"))).toBe(false);
  expect(isMitoport(join(DATA, "alignments", "mitoport", "x"))).toBe(false);
});
