import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KEPT_IN_GENERATED, KEPT_IN_PUBLIC_DATA, resetDir } from "../steps/output";

const made = () => {
  const dir = mkdtempSync(join(tmpdir(), "reset-"));
  writeFileSync(join(dir, "species.parquet"), "old");
  writeFileSync(join(dir, "complexes.json"), "{}");
  mkdirSync(join(dir, "alignments"));
  writeFileSync(join(dir, "alignments", "ND1.aa.fasta.gz"), "aln");
  mkdirSync(join(dir, "build1"));
  writeFileSync(join(dir, "build1", "x.parquet"), "old");
  return dir;
};

test("resetDir empties the folder but leaves, untouched, what other commands wrote", () => {
  const dir = made();
  expect(resetDir(dir, ["alignments", "complexes.json", "mitoport"])).toEqual(["alignments", "complexes.json"]);
  expect(readdirSync(dir).sort()).toEqual(["alignments", "complexes.json"]);
  expect(readFileSync(join(dir, "alignments", "ND1.aa.fasta.gz"), "utf8")).toBe("aln");
  expect(readFileSync(join(dir, "complexes.json"), "utf8")).toBe("{}");
});

test("resetDir with nothing to keep empties everything, and makes a missing folder", () => {
  const dir = made();
  expect(resetDir(dir)).toEqual([]);
  expect(readdirSync(dir)).toEqual([]);
  const missing = join(dir, "not", "there");
  expect(resetDir(missing, ["alignments"])).toEqual([]);
  expect(existsSync(missing)).toBe(true);
});

test("the kept names are the outputs of the other commands", () => {
  expect(KEPT_IN_PUBLIC_DATA.sort()).toEqual(["alignments", "mitoport"]);
  expect(KEPT_IN_GENERATED).toEqual(["complexes.json"]);
});
