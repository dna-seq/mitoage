import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDelimited } from "../lib/csv";
import { readParquet } from "../lib/parquet";
import { INPUT_DIR } from "../sources/mitoage";
import { losslessType, writeBuild1Snapshot } from "../steps/build1";

describe("build 1 snapshot", () => {
  test("lossless column typing", () => {
    expect(losslessType(["1", "22", ""])).toBe("INT32");
    expect(losslessType(["44.36", "1"])).toBe("DOUBLE");
    // "44.360" would print back as "44.36": stays text.
    expect(losslessType(["44.360", "1"])).toBe("STRING");
    expect(losslessType(["007"])).toBe("STRING");
    expect(losslessType(["", ""])).toBe("STRING");
    expect(losslessType(["NC_012920.1"])).toBe("STRING");
  });

  test.skipIf(!existsSync(INPUT_DIR))("every CSV cell round-trips through the parquet snapshot", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mitoage-build1-"));
    const files = await writeBuild1Snapshot(dir);
    const csvs = readdirSync(INPUT_DIR).filter((f) => f.endsWith(".csv"));
    expect(files.map((f) => f.csv).sort()).toEqual(csvs.sort());
    for (const f of files) {
      const rows = parseDelimited(await Bun.file(join(INPUT_DIR, f.csv)).text());
      const header = rows[0]!;
      const back = await readParquet(join(dir, f.parquet));
      expect(back.length).toBe(rows.length - 1);
      for (let i = 0; i < back.length; i++) {
        for (let j = 0; j < header.length; j++) {
          const v = back[i]![header[j]!];
          const text = v === null || v === undefined ? "" : String(v);
          if (text !== rows[i + 1]![j]) throw new Error(`${f.csv} row ${i + 2} column ${header[j]}: ${text} != ${rows[i + 1]![j]}`);
        }
      }
    }
  }, 120_000);
});
