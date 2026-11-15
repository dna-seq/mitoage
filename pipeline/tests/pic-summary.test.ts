import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { summarise } from "../pic-calibration";

// The committed calibration run: one TSV per scope, written by `pic-calibration.ts calibrate` on the cluster.
const SCOPES = join(import.meta.dir, "../../docs/analyses/pic-calibration/scopes");

const parse = (text: string) => {
  const [head, ...body] = text.trimEnd().split("\n");
  const cols = head!.split("\t");
  return body.map((l) => Object.fromEntries(l.split("\t").map((v, i) => [cols[i]!, v])));
};

describe("PIC calibration summary", () => {
  test("counts each scope's tests as the definitions say, on rows taken from the real run", () => {
    // A small real scope, cut to the rows that exercise every branch: significant both ways, a missing mass test.
    const text = readFileSync(join(SCOPES, "class_Mammalia.tsv"), "utf8").trimEnd().split("\n");
    const dir = mkdtempSync(join(tmpdir(), "pic-summary-"));
    writeFileSync(join(dir, "class_Mammalia.tsv"), `${text.slice(0, 301).join("\n")}\n`);
    const rows = parse(readFileSync(join(dir, "class_Mammalia.tsv"), "utf8"));
    const n = (r: Record<string, string>, c: string) => (r[c] === "" ? NaN : Number(r[c]));
    const fdr = rows.filter((r) => n(r, "q_value") < 0.05);
    const agree = (r: Record<string, string>, c: string) => n(r, c) * n(r, "pearson_r") > 0;
    const expected = {
      tests: rows.length,
      fdr: fdr.length,
      pic_t: rows.filter((r) => n(r, "pic_p_value") < 0.05).length,
      both_t: fdr.filter((r) => n(r, "pic_p_value") < 0.05 && agree(r, "pic_r")).length,
      opposite_t: fdr.filter((r) => n(r, "pic_p_value") < 0.05 && !agree(r, "pic_r")).length,
      both_pic_mass: fdr.filter((r) => n(r, "mass_p") < 0.05 && agree(r, "mass_r")).length,
    };
    const [got] = parse(summarise(dir));
    for (const [k, v] of Object.entries(expected)) expect(Number(got![k])).toBe(v);
    expect(expected.both_t + expected.opposite_t).toBeLessThanOrEqual(Math.min(expected.fdr, expected.pic_t));
    expect(expected.both_t).toBeGreaterThan(0);
    expect(expected.opposite_t).toBeGreaterThan(0);
  });

  test("over the whole run, the scopes' counts add up and the rows come largest first", () => {
    const out = parse(summarise(SCOPES));
    expect(out.map((r) => r.scope).sort()).toEqual(readdirSync(SCOPES).map((f) => f.replace(/\.tsv$/, "").replace("_", ":")).sort());
    const total = readdirSync(SCOPES).reduce((s, f) => s + parse(readFileSync(join(SCOPES, f), "utf8")).length, 0);
    expect(out.reduce((s, r) => s + Number(r.tests), 0)).toBe(total);
    for (let i = 1; i < out.length; i++) expect(Number(out[i - 1]!["p<.05"])).toBeGreaterThanOrEqual(Number(out[i]!["p<.05"]));
    // A scope with no masses (Bivalvia) counts no mass tests, and its null shares skip the test without replicates.
    const biv = out.find((r) => r.scope === "class:Bivalvia")!;
    expect(biv.mass_tests).toBe("0");
    expect(Number(biv.bm_null_pct)).toBeGreaterThan(4);
  });

  test("an empty folder and a table without a needed column are refused", () => {
    const empty = mkdtempSync(join(tmpdir(), "pic-summary-"));
    expect(() => summarise(empty)).toThrow(/no scope TSVs/);
    const bad = mkdtempSync(join(tmpdir(), "pic-summary-"));
    writeFileSync(join(bad, "all.tsv"), "scope\tfeature\nall\tgc:total\n");
    expect(() => summarise(bad)).toThrow(/no column/);
  });
});
