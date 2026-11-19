import { describe, expect, test } from "bun:test";
import { getAllSpecies } from "~/data";
import { CONFIDENCE_LABEL, CONFIDENCE_LEVELS, CONFIDENCE_MEANING, CONFIDENCE_REASONS, type ConfidenceLevel, DEFAULT_SHOWN_LEVELS, confidenceReasonText, rowsAtLevels } from "./confidence";

describe("confidence levels on the site", () => {
  test("every level has a label and a meaning; all but the lowest are shown by default", () => {
    for (const l of CONFIDENCE_LEVELS) {
      expect(CONFIDENCE_LABEL[l].length).toBeGreaterThan(0);
      expect(CONFIDENCE_MEANING[l].length).toBeGreaterThan(0);
    }
    expect([...DEFAULT_SHOWN_LEVELS]).toEqual(CONFIDENCE_LEVELS.filter((l) => l !== CONFIDENCE_LEVELS.at(-1)));
    expect(CONFIDENCE_LEVELS.at(-1)).toBe("unreliable");
  });

  test("a reason is said in words; a code with a detail too; an unknown code is shown as written", () => {
    expect(confidenceReasonText("tiny_sample")).toBe(CONFIDENCE_REASONS["tiny_sample"]!.text);
    expect(confidenceReasonText("possible_duplicate:Gadus ogac")).toBe(CONFIDENCE_REASONS["possible_duplicate"]!.text);
    expect(confidenceReasonText("some_new_reason")).toBe("some new reason");
  });

  test("rows are kept by level; a row without a level, or with a value that is no level, is never dropped", () => {
    const rows = [{ c: "high" }, { c: "caveat" }, { c: "low" }, { c: "unreliable" }, { c: null }, { c: "?" }, { c: 3 }];
    const at = (levels: ConfidenceLevel[]) => rowsAtLevels(rows, (r) => r.c, new Set(levels)).map((r) => r.c);
    expect(at([...DEFAULT_SHOWN_LEVELS])).toEqual(["high", "caveat", "low", null, "?", 3]);
    expect(at([...CONFIDENCE_LEVELS])).toEqual(rows.map((r) => r.c));
    expect(at([])).toEqual([null, "?", 3]);
    expect(at(["unreliable"])).toEqual(["unreliable", null, "?", 3]);
  });

  test("the committed build: every species has a level, every reason is a known one, and the level is the worst of its reasons'", () => {
    const species = getAllSpecies();
    const counts: Record<string, number> = {};
    for (const s of species) {
      const c = s.confidence;
      expect(c, s.slug).toBeDefined();
      counts[c!.level] = (counts[c!.level] ?? 0) + 1;
      const levels = c!.reasons.map((r) => CONFIDENCE_REASONS[r.split(":")[0]!]?.level);
      expect(levels.every((l) => l !== undefined), `${s.slug}: ${c!.reasons.join(", ")}`).toBe(true);
      const worst = Math.max(0, ...levels.map((l) => CONFIDENCE_LEVELS.indexOf(l!)));
      expect(CONFIDENCE_LEVELS[worst], s.slug).toBe(c!.level);
      expect(c!.level === "high", s.slug).toBe(c!.reasons.length === 0);
    }
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(species.length);
    // a retired record is unreliable, whatever else is known of it
    for (const s of species) if (s.provenance?.recordStatus === "retired") expect(s.confidence!.level, s.slug).toBe("unreliable");
  });
});
