/**
 * The SQLite copy of the published build: `bun run sqlite` writes out/hf/mitoage.sqlite, the single
 * file the MCP server (mcp/) opens. One table per download, with the published column names and the
 * published rows, plus `correlations`, and the build's own description in `build_info`,
 * `correlation_dataset` and `source`.
 *
 * It runs after `bun run hf` (which empties out/hf/) and needs dist/data/correlations.parquet, which
 * `bun run build` writes: the correlations are derived during the site build (D3) and are not
 * committed. Both inputs are checked, and a missing one stops the run naming the command that makes
 * it. Nothing here talks to Hugging Face; the upload is `bun run hf`'s line, run by hand.
 */
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { BuildInfo } from "../src/data/schema";
import { readParquet, type Row } from "./lib/parquet";

const ROOT = join(import.meta.dir, "..");
const PUBLIC = join(ROOT, "public", "data");
const DIST = join(ROOT, "dist", "data");
const OUT = join(ROOT, "out", "hf");

/** The tables, in the order written. `dir` names the folder the parquet comes from. */
export const TABLES: readonly { table: string; file: string; dir: "public" | "dist" }[] = [
  { table: "species", file: "species.parquet", dir: "public" },
  { table: "region_stats", file: "region_stats.parquet", dir: "public" },
  { table: "codon_usage", file: "codon_usage.parquet", dir: "public" },
  { table: "genome_features", file: "genome_features.parquet", dir: "public" },
  { table: "protein_gene_features", file: "protein_gene_features.parquet", dir: "public" },
  { table: "mtdna_structure", file: "mtdna_structure.parquet", dir: "public" },
  { table: "lifespan_observations", file: "lifespan_observations.parquet", dir: "public" },
  { table: "changelog", file: "changelog.parquet", dir: "public" },
  { table: "correlations", file: "correlations.parquet", dir: "dist" },
];

/** Indexes, by table and the columns they cover. Every column is checked against the table first. */
export const INDEXES: readonly { table: string; columns: string[] }[] = [
  { table: "species", columns: ["slug"] },
  { table: "species", columns: ["scientific_name"] },
  { table: "species", columns: ["class"] },
  { table: "region_stats", columns: ["species_id"] },
  { table: "region_stats", columns: ["region"] },
  { table: "codon_usage", columns: ["species_id"] },
  { table: "genome_features", columns: ["species_id"] },
  { table: "protein_gene_features", columns: ["species_id"] },
  { table: "mtdna_structure", columns: ["species_id"] },
  { table: "lifespan_observations", columns: ["species_id"] },
  { table: "changelog", columns: ["table", "row_key"] },
  { table: "correlations", columns: ["feature_key", "trait", "scope"] },
  { table: "correlations", columns: ["trait", "scope", "dataset"] },
];

export type SqlType = "INTEGER" | "REAL" | "TEXT";

/**
 * The column's SQLite type: INTEGER when every value is a whole number (booleans count, stored as
 * 0 and 1), REAL when every value is a number, TEXT otherwise. A column with no value at all is
 * TEXT, which stores anything a later build puts there.
 */
export function columnType(values: Iterable<unknown>): SqlType {
  let seen = false;
  let whole = true;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    seen = true;
    if (typeof v === "boolean" || typeof v === "bigint") continue;
    if (typeof v === "number") {
      if (!Number.isInteger(v)) whole = false;
      continue;
    }
    return "TEXT";
  }
  if (!seen) return "TEXT";
  return whole ? "INTEGER" : "REAL";
}

/** What `node:sqlite` binds. Anything else is a build error: nothing here guesses an encoding. */
export type Bound = null | number | string;

/** One value, ready to bind. Non-finite numbers are counted by column, never passed over in silence. */
export function bind(value: unknown, where: string, nonFinite: Map<string, number>): Bound {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    nonFinite.set(where, (nonFinite.get(where) ?? 0) + 1);
    return null;
  }
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  throw new Error(`${where}: ${Object.prototype.toString.call(value)} is not a value this writer stores`);
}

const quote = (name: string): string => `"${name.replace(/"/g, '""')}"`;

/** Create one table from the parquet rows and fill it, in the rows' order. Returns its columns. */
export function writeTable(db: DatabaseSync, table: string, rows: Row[], nonFinite: Map<string, number>): string[] {
  if (rows.length === 0) throw new Error(`${table}: the parquet holds no row`);
  const columns = Object.keys(rows[0]!);
  for (const r of rows) {
    // Column order is the first row's; a row that disagrees would silently shift the values.
    const keys = Object.keys(r);
    if (keys.length !== columns.length || keys.some((k, i) => k !== columns[i])) {
      throw new Error(`${table}: a row has columns ${keys.join(", ")}, the first row has ${columns.join(", ")}`);
    }
  }
  const types = columns.map((c) => columnType(rows.map((r) => r[c])));
  db.exec(`CREATE TABLE ${quote(table)} (${columns.map((c, i) => `${quote(c)} ${types[i]}`).join(", ")})`);
  const insert = db.prepare(`INSERT INTO ${quote(table)} VALUES (${columns.map(() => "?").join(", ")})`);
  db.exec("BEGIN");
  for (const r of rows) insert.run(...columns.map((c) => bind(r[c], `${table}.${c}`, nonFinite)));
  db.exec("COMMIT");
  return columns;
}

/**
 * The written table against the parquet it came from: the row count, and for every column the
 * number of values that are not null and, where the column holds numbers, their sum. Equality over
 * all three is a round trip of every value, without holding both copies to compare row by row.
 */
export function checkTable(db: DatabaseSync, table: string, rows: Row[], columns: string[]): void {
  const count = (db.prepare(`SELECT count(*) AS n FROM ${quote(table)}`).get() as { n: number }).n;
  if (count !== rows.length) throw new Error(`${table}: ${count} rows written, ${rows.length} read from the parquet`);
  for (const c of columns) {
    let filled = 0;
    let sum = 0;
    let numeric = true;
    for (const r of rows) {
      const v = r[c];
      if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) continue;
      filled += 1;
      if (typeof v === "boolean") sum += v ? 1 : 0;
      else if (typeof v === "number" || typeof v === "bigint") sum += Number(v);
      else numeric = false;
    }
    const got = db.prepare(`SELECT count(${quote(c)}) AS filled, total(${quote(c)}) AS sum FROM ${quote(table)}`).get() as {
      filled: number;
      sum: number;
    };
    if (got.filled !== filled) throw new Error(`${table}.${c}: ${got.filled} values written, ${filled} in the parquet`);
    // Floating-point addition is not associative, so the sums are compared to a relative tolerance.
    if (numeric && Math.abs(got.sum - sum) > 1e-6 * Math.max(1, Math.abs(sum))) {
      throw new Error(`${table}.${c}: the written values sum to ${got.sum}, the parquet's to ${sum}`);
    }
  }
}

/** The build's own description: one row of `build_info`, and a row per dataset and per source. */
export function writeBuildInfo(db: DatabaseSync, info: BuildInfo, generatedAt: string): void {
  db.exec(
    `CREATE TABLE "build_info" ("build" TEXT, "build_number" INTEGER, "build_date" TEXT,` +
      ` "generated_at" TEXT, "species_count" INTEGER, "database_generated_at" TEXT)`,
  );
  db.prepare(`INSERT INTO "build_info" VALUES (?, ?, ?, ?, ?, ?)`).run(
    info.build,
    info.buildNumber ?? null,
    info.buildDate ?? null,
    info.generatedAt ?? null,
    info.speciesCount ?? null,
    generatedAt,
  );
  db.exec(`CREATE TABLE "correlation_dataset" ("dataset" TEXT, "filters" TEXT, "lifespan_sources" TEXT, "species" INTEGER)`);
  const ds = db.prepare(`INSERT INTO "correlation_dataset" VALUES (?, ?, ?, ?)`);
  for (const d of info.correlationDatasets ?? []) ds.run(d.dataset, d.filters, d.lifespanSources.join("; "), d.species ?? null);
  db.exec(`CREATE TABLE "source" ("name" TEXT, "version" TEXT, "url" TEXT, "license" TEXT)`);
  const src = db.prepare(`INSERT INTO "source" VALUES (?, ?, ?, ?)`);
  for (const s of info.sources ?? []) src.run(s.name, s.version ?? null, s.url ?? null, s.license ?? null);
}

if (import.meta.main) {
  if (!existsSync(OUT)) throw new Error(`${OUT} is missing: run \`bun run hf\` first, which writes the folder this file joins`);
  const correlations = join(DIST, "correlations.parquet");
  if (!existsSync(correlations)) {
    throw new Error(`${correlations} is missing: run \`bun run build\` first, which derives the correlations (D3)`);
  }
  const info = JSON.parse(readFileSync(join(ROOT, "src", "data", "generated", "build-info.json"), "utf8")) as BuildInfo;
  const path = join(OUT, "mitoage.sqlite");
  rmSync(path, { force: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = OFF");
  const nonFinite = new Map<string, number>();
  const counts: string[] = [];
  for (const t of TABLES) {
    const rows = await readParquet(join(t.dir === "public" ? PUBLIC : DIST, t.file));
    const columns = writeTable(db, t.table, rows, nonFinite);
    checkTable(db, t.table, rows, columns);
    counts.push(`${t.table} ${rows.length}`);
  }
  writeBuildInfo(db, info, new Date().toISOString());
  const columnsOf = (table: string): Set<string> =>
    new Set((db.prepare(`PRAGMA table_info(${quote(table)})`).all() as { name: string }[]).map((r) => r.name));
  for (const ix of INDEXES) {
    const have = columnsOf(ix.table);
    const missing = ix.columns.filter((c) => !have.has(c));
    if (missing.length > 0) throw new Error(`index on ${ix.table}: the table has no column ${missing.join(", ")}`);
    const name = `ix_${ix.table}_${ix.columns.join("_")}`;
    db.exec(`CREATE INDEX ${quote(name)} ON ${quote(ix.table)} (${ix.columns.map(quote).join(", ")})`);
  }
  if (info.buildNumber !== undefined && info.buildNumber !== null) db.exec(`PRAGMA user_version = ${Number(info.buildNumber)}`);
  db.exec("VACUUM");
  db.close();
  for (const [where, n] of [...nonFinite].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.warn(`${where}: ${n} non-finite ${n === 1 ? "number" : "numbers"} stored as null`);
  }
  console.log(`out/hf/mitoage.sqlite: ${counts.join(", ")}; ${(statSync(path).size / 1e6).toFixed(1)} MB`);
}
