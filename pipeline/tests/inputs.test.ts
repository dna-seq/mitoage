import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { build1Csv, csvCell, fetchChecked, place, placeRecords, recordedCsvDigests, writeBuild1Csvs } from "../inputs";
import { csvToColumns } from "../steps/build1";
import { parquetBuffer, readParquet } from "../lib/parquet";

const BUILD1 = join(import.meta.dir, "..", "..", "public", "data", "build1");
const sha256 = (b: string | Uint8Array) => createHash("sha256").update(b).digest("hex");
const md5 = (b: string | Uint8Array) => createHash("md5").update(b).digest("hex");
const tmp = () => mkdtempSync(join(tmpdir(), "inputs-"));

describe("the 2015 export written back from parquet", () => {
  test("a cell is quoted only when it must be; null is empty", () => {
    expect(csvCell("Homo sapiens")).toBe("Homo sapiens");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(12.5)).toBe("12.5");
  });
  test("CSV to parquet and back gives the same bytes, with empty cells, quotes and numbers kept as text", async () => {
    const text = 'id,name,note,size\r\n1,Aus bus,"has, comma",1.50\r\n2,"Cus ""d"" us",,2.25\r\n3,Eus,plain,\r\n';
    const rows = await readParquet(parquetBuffer(csvToColumns(text)));
    expect(build1Csv(["id", "name", "note", "size"], rows)).toBe(text);
  });
  test("every committed build 1 table comes back with the SHA-256 its README records", async () => {
    const out = tmp();
    const r = await writeBuild1Csvs(BUILD1, out);
    const want = recordedCsvDigests(readFileSync(join(BUILD1, "README.md"), "utf8"));
    expect(r.refused).toEqual([]);
    expect(want.size).toBeGreaterThan(30);
    expect(r.written.sort()).toEqual([...want.keys()].map((f) => f.replace(/\.parquet$/, ".csv")).sort());
    for (const [parquet, digest] of want) expect(sha256(readFileSync(join(out, parquet.replace(/\.parquet$/, ".csv"))))).toBe(digest);
    expect(readdirSync(out).sort()).toEqual(r.written.sort());
  });
  test("a table whose CSV would not have the recorded digest is refused and not written", async () => {
    const src = tmp();
    const out = tmp();
    const name = "ATP8_base_composition.parquet";
    copyFileSync(join(BUILD1, name), join(src, name));
    const readme = readFileSync(join(BUILD1, "README.md"), "utf8").split("\n").filter((l) => !l.startsWith("| ") || l.startsWith(`| ${name} `) || l.startsWith("| file") || l.startsWith("| ---"));
    writeFileSync(join(src, "README.md"), readme.join("\n").replace(/`[0-9a-f]{64}`/, "`" + "0".repeat(64) + "`"));
    const r = await writeBuild1Csvs(src, out);
    expect(r.written).toEqual([]);
    expect(r.refused.length).toBe(1);
    expect(readdirSync(out)).toEqual([]);
  });
  test("a parquet file the README does not list, or a listed one that is absent, stops the run", async () => {
    const src = tmp();
    copyFileSync(join(BUILD1, "ATP8_base_composition.parquet"), join(src, "ATP8_base_composition.parquet"));
    writeFileSync(join(src, "README.md"), "| file | rows | columns | SHA-256 of the source CSV |\n");
    await expect(writeBuild1Csvs(src, tmp())).rejects.toThrow(/disagree/);
    const src2 = tmp();
    writeFileSync(join(src2, "README.md"), `| X_base_composition.parquet | 1 | 1 | \`${"a".repeat(64)}\` |\n`);
    await expect(writeBuild1Csvs(src2, tmp())).rejects.toThrow(/disagree/);
  });
});

describe("files put in place", () => {
  test("a file already there with the expected md5 is not fetched; with another md5 it is refused and left alone", async () => {
    const dir = tmp();
    const path = join(dir, "a.bin");
    writeFileSync(path, "pinned content");
    // the address is never asked: nothing listens there
    expect(await fetchChecked("http://127.0.0.1:9/never", path, md5("pinned content"))).toBe("in place");
    await expect(fetchChecked("http://127.0.0.1:9/never", path, md5("other content"))).rejects.toThrow(/refused/);
    expect(readFileSync(path, "utf8")).toBe("pinned content");
  });
  test("place writes once, accepts the same bytes again and refuses other bytes", () => {
    const path = join(tmp(), "sub", "x.txt");
    place(path, "one");
    place(path, "one");
    expect(() => place(path, "two")).toThrow(/refused/);
    expect(readFileSync(path, "utf8")).toBe("one");
  });
  test("a concatenated GenBank file becomes one file per record, named by its version, each ending in //", () => {
    const dir = tmp();
    const rec = (v: string) => `LOCUS       ${v.split(".")[0]}   10 bp\nVERSION     ${v}\nORIGIN\n        1 acgtacgtac\n//\n`;
    const gz = join(dir, "two.gbff.gz");
    writeFileSync(gz, gzipSync(rec("NC_000001.1") + "\n" + rec("NC_000002.3")));
    const out = join(dir, "out");
    expect(placeRecords(gz, out)).toBe(2);
    expect(readdirSync(out).sort()).toEqual(["NC_000001.1.gb", "NC_000002.3.gb"]);
    expect(readFileSync(join(out, "NC_000002.3.gb"), "utf8")).toBe(rec("NC_000002.3"));
    const bad = join(dir, "bad.gbff.gz");
    writeFileSync(bad, gzipSync("LOCUS       X   10 bp\nORIGIN\n//\n"));
    expect(() => placeRecords(bad, join(dir, "out2"))).toThrow(/VERSION/);
  });
});
