/**
 * `bun run inputs`: put the raw inputs of `bun run data` where it reads them, on a machine that has only a
 * clone. Nothing here is committed: data/input and data/cache are not in git.
 *
 *   data/input/mitoage_build1_full_database/   the 34 CSVs of the 2015 export, written back from the committed
 *                                              parquet copies (public/data/build1/); a CSV is kept only when its
 *                                              SHA-256 is the one public/data/build1/README.md records for it
 *   data/cache/...                             the pinned build 2 sources, from the public snapshot
 *                                              longevity-genie/mitoage-build2-sources at SNAPSHOT_REVISION, and
 *                                              the EURING list from the Internet Archive
 *
 * Each snapshot file is checked against the md5 its MANIFEST.json gives, and the manifest against the digest
 * pinned below; AnAge, the RefSeq release and the EURING list also against the md5 `bun run data` pins. That
 * shows the transfer was whole. Whether the inputs are the right ones is shown by `bun run data` writing the
 * committed build again, byte for byte, which this command does not do.
 *
 * A file already in place with the right digest is not fetched again. A file in place with another digest
 * is refused, never overwritten: move it away first.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { CACHE_DIR, ROOT, fetchWithRetry } from "./lib/cache";
import { splitRecords } from "./lib/genbank";
import { md5File, readParquet } from "./lib/parquet";
import { INPUT_DIR } from "./sources/mitoage";
import { ANAGE_PINNED, EURING, FISHBASE, NCBI_TAXONOMY, REFSEQ_RELEASE, SEALIFEBASE, USGS_BBL, cacheFile } from "./sources/pinned";

export const SNAPSHOT_REPO = "longevity-genie/mitoage-build2-sources";
export const SNAPSHOT_REVISION = "a76215144ec33d6ed1e5ea599cb797f2651dab1a";
export const SNAPSHOT_MANIFEST_SHA256 = "0e0bfec1f07dc28216c6065b619357fcec73f7cd2f3102a40dd0fe2dba17847a";
const SNAPSHOT_URL = `https://huggingface.co/datasets/${SNAPSHOT_REPO}/resolve/${SNAPSHOT_REVISION}`;
const SNAPSHOT_DIR = join(CACHE_DIR, "snapshot", SNAPSHOT_REVISION);
const BUILD1_PARQUET = join(ROOT, "public", "data", "build1");
const PARQUET_TABLES = ["species", "popchar", "popgrowth", "synonyms"];

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

/** One cell of the 2015 export as it was written: quoted only when it holds a comma, a quote or a line break. */
export function csvCell(value: unknown): string {
  const c = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
}

/** The 2015 export's CSV text of a table: CRLF line ends, one after the last row too. */
export function build1Csv(header: string[], rows: Record<string, unknown>[]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) lines.push(header.map((h) => csvCell(r[h])).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** file.parquet -> the SHA-256 of the CSV it was made from, as public/data/build1/README.md records it. */
export function recordedCsvDigests(readme: string): Map<string, string> {
  return new Map([...readme.matchAll(/^\| (\S+\.parquet) \| \d+ \| \d+ \| `([0-9a-f]{64})` \|$/gm)].map((m) => [m[1]!, m[2]!]));
}

/** Writes the CSVs whose digest is the recorded one; returns what was written and what was refused. */
export async function writeBuild1Csvs(parquetDir = BUILD1_PARQUET, outDir = INPUT_DIR): Promise<{ written: string[]; refused: string[] }> {
  const want = recordedCsvDigests(readFileSync(join(parquetDir, "README.md"), "utf8"));
  const files = readdirSync(parquetDir).filter((f) => f.endsWith(".parquet")).sort();
  const unlisted = files.filter((f) => !want.has(f));
  const absent = [...want.keys()].filter((f) => !files.includes(f));
  if (unlisted.length || absent.length) {
    throw new Error(`public/data/build1 and its README disagree: no digest for ${unlisted.join(", ") || "none"}; no file for ${absent.join(", ") || "none"}`);
  }
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  const refused: string[] = [];
  for (const f of files) {
    const rows = await readParquet(join(parquetDir, f));
    if (rows.length === 0) {
      refused.push(`${f}: no rows, so its columns cannot be read`);
      continue;
    }
    const text = build1Csv(Object.keys(rows[0]!), rows);
    const csv = f.replace(/\.parquet$/, ".csv");
    if (sha256(text) !== want.get(f)) {
      refused.push(`${f}: the CSV written back has another SHA-256 than the recorded one`);
      continue;
    }
    writeFileSync(join(outDir, csv), text);
    written.push(csv);
  }
  return { written, refused };
}

export interface ManifestEntry {
  path: string;
  md5: string;
  bytes: number;
}

/** Fetches `url` to `path` unless a file with `md5` is there; refuses a file with another md5, in place or fetched. */
export async function fetchChecked(url: string, path: string, md5: string): Promise<"in place" | "fetched"> {
  if (existsSync(path)) {
    const have = await md5File(path);
    if (have === md5) return "in place";
    throw new Error(`${path} is in place with md5 ${have}, expected ${md5}: refused; move it away and run again`);
  }
  const res = await fetchWithRetry(url);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const got = createHash("md5").update(bytes).digest("hex");
  if (got !== md5) throw new Error(`${url} has md5 ${got}, expected ${md5}: not written`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return "fetched";
}

/** Writes `bytes` to `path`; a file already there must hold the same bytes. */
export function place(path: string, bytes: Uint8Array | string): void {
  const b = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  if (existsSync(path)) {
    if (sha256(readFileSync(path)) !== sha256(b)) throw new Error(`${path} is in place with other content: refused; move it away and run again`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, b);
}

/** Each record of a concatenated GenBank file as `bun run data` caches it: <dir>/<accession.version>.gb. */
export function placeRecords(gbffGz: string, dir: string): number {
  const records = splitRecords(gunzipSync(readFileSync(gbffGz)).toString("utf8"));
  for (const rec of records) {
    const ver = /^VERSION\s+(\S+)/m.exec(rec)?.[1];
    if (!ver) throw new Error(`a record of ${gbffGz} has no VERSION line`);
    place(join(dir, `${ver}.gb`), rec);
  }
  return records.length;
}

async function untar(archive: string, dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const p = Bun.spawn(["tar", "-xzf", archive, "-C", dir, "--skip-old-files"], { stderr: "pipe" });
  if ((await p.exited) !== 0) throw new Error(`tar could not unpack ${archive}: ${await new Response(p.stderr).text()}`);
}

if (import.meta.main) {
  const b1 = await writeBuild1Csvs();
  console.log(`build 1 export: ${b1.written.length} CSVs written to data/input/mitoage_build1_full_database, each with its recorded SHA-256`);
  for (const r of b1.refused) console.log(`  REFUSED ${r}`);

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const manifestPath = join(SNAPSHOT_DIR, "MANIFEST.json");
  if (!existsSync(manifestPath)) writeFileSync(manifestPath, new Uint8Array(await (await fetchWithRetry(`${SNAPSHOT_URL}/MANIFEST.json`)).arrayBuffer()));
  const got = sha256(readFileSync(manifestPath));
  if (got !== SNAPSHOT_MANIFEST_SHA256) throw new Error(`the snapshot's MANIFEST.json has SHA-256 ${got}, pinned ${SNAPSHOT_MANIFEST_SHA256}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestEntry[];
  const entry = (path: string) => {
    const e = manifest.find((m) => m.path === path);
    if (!e) throw new Error(`the snapshot's manifest has no ${path}`);
    return e;
  };
  const counts = { "in place": 0, fetched: 0 };
  const snap = async (path: string, to = join(SNAPSHOT_DIR, path), pinned?: string) => {
    const e = entry(path);
    if (pinned && pinned !== e.md5) throw new Error(`${path}: the snapshot says md5 ${e.md5}, the pipeline pins ${pinned}`);
    counts[await fetchChecked(`${SNAPSHOT_URL}/${path}`, to, e.md5)]++;
    return to;
  };

  await snap("refseq/release237/mitochondrion.1.genomic.gbff.gz", cacheFile(REFSEQ_RELEASE), REFSEQ_RELEASE.md5);
  await snap("anage/dataset.zip", cacheFile(ANAGE_PINNED), ANAGE_PINNED.md5);
  for (const t of PARQUET_TABLES) {
    await snap(`fishbase/v26.06/${t}.parquet`, cacheFile(FISHBASE, `${t}.parquet`));
    await snap(`sealifebase/v26.06/${t}.parquet`, cacheFile(SEALIFEBASE, `${t}.parquet`));
  }
  await snap("usgs_bbl/longevity.csv", cacheFile(USGS_BBL));
  await untar(await snap("taxonomy/new_taxdump_2026-11-13.tar.gz"), cacheFile(NCBI_TAXONOMY));
  await untar(await snap("tree/answers.tar.gz"), join(CACHE_DIR, "tree"));
  await untar(await snap("legacy/total_mtDNA_pages.tar.gz"), join(CACHE_DIR, "legacy"));
  let records = placeRecords(await snap("genbank/cited.gbff.gz"), join(CACHE_DIR, "genbank"));
  records += placeRecords(await snap("genbank/contig.gbff.gz"), join(CACHE_DIR, "genbank"));
  const primary = placeRecords(await snap("genbank/primary.gbff.gz"), join(CACHE_DIR, "build2", "genbank_primary"));
  if (!EURING.md5) throw new Error("the EURING list has no pinned md5");
  counts[await fetchChecked(EURING.url, cacheFile(EURING), EURING.md5)]++;

  console.log(`build 2 sources: ${counts.fetched} files fetched, ${counts["in place"]} already in place, each with its md5`);
  console.log(`  ${records} GenBank records under data/cache/genbank, ${primary} under data/cache/build2/genbank_primary`);
  console.log("  taxonomy, tree answers and old-site pages unpacked; files already there were left as they were");
  if (b1.refused.length) process.exit(1);
}
