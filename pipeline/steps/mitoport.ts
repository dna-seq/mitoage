/**
 * The coevolution tables of mitoage-pipelines (pipeline/sources/mitoport.ts) turned into parquet without
 * changing a value: each TSV column becomes one parquet column, typed by what every cell of it holds, an
 * empty cell becomes null (not assessed), and a header with spaces gets underscores (the renaming is
 * recorded). Used by `bun run mitoport` (pipeline/mitoport.ts).
 */
import { createHash } from "node:crypto";
import { parseDelimited } from "../lib/csv";
import type { Column, ColType } from "../lib/parquet";

/** Refuse bytes whose SHA-256 is not the pinned one: a pinned input is never silently replaced. */
export function verifySha256(bytes: Uint8Array, expected: string, label: string): string {
  const got = createHash("sha256").update(bytes).digest("hex");
  if (got !== expected) throw new Error(`${label}: SHA-256 ${got} is not the pinned ${expected}; the file is not the one this build was made from`);
  return got;
}

const INT = /^[+-]?\d+$/;
const NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** The parquet type of a column from its non-empty cells: INT32, DOUBLE, or STRING when any cell is not a number. */
export function columnType(cells: readonly string[]): ColType {
  const filled = cells.filter((c) => c !== "");
  if (!filled.length) return "STRING";
  if (filled.every((c) => INT.test(c) && Math.abs(Number(c)) < 2 ** 31)) return "INT32";
  if (filled.every((c) => NUM.test(c))) return "DOUBLE";
  return "STRING";
}

export interface ConvertedTable {
  columns: Column[];
  rows: number;
  /** Source header -> parquet column name, for the headers that were changed. */
  renamed: Record<string, string>;
}

/** A TSV with a header row as typed columns. Refuses a ragged row, an empty or repeated header, or no rows. */
export function tsvColumns(text: string, label: string): ConvertedTable {
  const all = parseDelimited(text, "\t");
  const header = all[0];
  if (!header || !header.length) throw new Error(`${label}: no header`);
  const body = all.slice(1);
  if (!body.length) throw new Error(`${label}: no rows`);
  body.forEach((r, i) => {
    if (r.length !== header.length) throw new Error(`${label}: row ${i + 2} has ${r.length} fields, the header ${header.length}`);
  });
  const renamed: Record<string, string> = {};
  const names = header.map((h) => {
    if (!h.trim()) throw new Error(`${label}: an empty column name`);
    const n = h.trim().replace(/\s+/g, "_");
    if (n !== h) renamed[h] = n;
    return n;
  });
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) throw new Error(`${label}: column ${dup} appears twice`);
  const columns = names.map((name, j): Column => {
    const cells = body.map((r) => r[j]!);
    const type = columnType(cells);
    const data = cells.map((c) => (c === "" ? null : type === "STRING" ? c : Number(c)));
    return { name, type, data };
  });
  return { columns, rows: body.length, renamed };
}

/** A list with one value per line (species.txt) as a one-column table. Refuses blank or repeated lines. */
export function listColumn(text: string, name: string, label: string): ConvertedTable {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (!lines.length) throw new Error(`${label}: empty`);
  const seen = new Set<string>();
  lines.forEach((l, i) => {
    if (!l.trim() || l !== l.trim()) throw new Error(`${label}: line ${i + 1} is blank or has surrounding spaces`);
    if (seen.has(l)) throw new Error(`${label}: ${l} appears twice`);
    seen.add(l);
  });
  return { columns: [{ name, type: "STRING", data: lines }], rows: lines.length, renamed: {} };
}

/** The table a file becomes: TSVs by their header, species.txt as a column `slug`. */
export function convert(path: string, text: string): ConvertedTable {
  if (path.endsWith(".tsv")) return tsvColumns(text, path);
  if (path.endsWith("species.txt")) return listColumn(text, "slug", path);
  throw new Error(`${path}: no conversion for this kind of file`);
}

/** Where a source file lands under public/data/mitoport/: the same path, as .parquet. */
export const parquetName = (path: string): string => path.replace(/\.(tsv|txt)$/, ".parquet");

export interface LifespanNull {
  /** True only when every tested row is null; an untested or unreadable row never counts as null. */
  holds: boolean;
  /** Fits of partners.tsv with status "tested", and the smallest q among them. */
  testedFits: number;
  smallestQ: number | null;
  /** Classes partners.tsv did not assess, with the reason it gives. */
  notAssessed: { class: string; reason: string }[];
  /** Rows of iface/lifespan.tsv, all of whose 95% intervals must include zero. */
  intervals: number;
  /** Why the claim does not hold, one line per offending row. */
  failures: string[];
}

/**
 * Whether the tables bear out "none of these features follows lifespan": every fit of partners.tsv (H12) has
 * q >= 0.05, and every slope of iface/lifespan.tsv (H9) has a 95% interval that includes zero. A missing q or
 * interval is a failure (unknown is not null), so the claim is printed only where the data show it.
 */
export function lifespanNull(partners: Record<string, unknown>[], lifespan: Record<string, unknown>[]): LifespanNull {
  const failures: string[] = [];
  const notAssessed: LifespanNull["notAssessed"] = [];
  let testedFits = 0;
  let smallestQ: number | null = null;
  for (const r of partners) {
    const where = `partners: ${String(r["class"])}, ${String(r["feature"])}, ${String(r["model"])}`;
    if (r["status"] !== "tested") {
      const reason = String(r["status"] ?? "no status");
      if (!reason.startsWith("not assessed")) failures.push(`${where}: status "${reason}"`);
      else if (!notAssessed.some((n) => n.class === r["class"])) notAssessed.push({ class: String(r["class"]), reason: reason.replace(/^not assessed:\s*/, "").trim() });
      continue;
    }
    testedFits++;
    const q = r["q"];
    if (typeof q !== "number" || !Number.isFinite(q)) failures.push(`${where}: no q`);
    else {
      smallestQ = smallestQ === null ? q : Math.min(smallestQ, q);
      if (q < 0.05) failures.push(`${where}: q = ${q}`);
    }
  }
  for (const r of lifespan) {
    const where = `lifespan: ${String(r["set"])}, ${String(r["variable"])}`;
    const lo = r["ci95_low"];
    const hi = r["ci95_high"];
    if (typeof lo !== "number" || typeof hi !== "number") failures.push(`${where}: no interval`);
    else if (lo > 0 || hi < 0) failures.push(`${where}: interval [${lo}, ${hi}] excludes zero`);
  }
  if (!testedFits) failures.push("partners: no tested fit");
  if (!lifespan.length) failures.push("lifespan: no rows");
  return { holds: failures.length === 0, testedFits, smallestQ, notAssessed, intervals: lifespan.length, failures };
}

/** Rows read back from the parquet must equal the converted columns, cell for cell. Returns the first difference. */
export function firstDifference(table: ConvertedTable, back: Record<string, unknown>[]): string | null {
  if (back.length !== table.rows) return `${back.length} rows read back, ${table.rows} written`;
  for (const c of table.columns) {
    for (let i = 0; i < table.rows; i++) {
      const want = c.data[i] ?? null;
      const got = back[i]![c.name] ?? null;
      if (!Object.is(want, got)) return `column ${c.name}, row ${i + 1}: wrote ${String(want)}, read ${String(got)}`;
    }
  }
  return null;
}
