import { describe, expect, test } from "bun:test";
import { getAllSpecies } from "~/data";
import { RECORD_STATUSES } from "~/data/schema";
import { isNonCommercial, licenceName, lifespanSourceLink, lifespanSourceName, recordStatusLabel, recordTypeLabel, reviewFlagText } from "./provenance";

const all = getAllSpecies();

describe("provenance of a species record", () => {
  test("every species of the build gets a named source, a record type and a short licence", () => {
    for (const s of all) {
      expect(s.lifespan, s.slug).toBeDefined();
      expect(lifespanSourceName(s.lifespan!.source), s.slug).toBeTruthy();
      expect(recordTypeLabel(s.lifespan!.recordType), s.slug).toBeTruthy();
      const name = licenceName(s.lifespan!.license);
      expect(name.length, s.slug).toBeGreaterThan(0);
      expect(name, s.slug).not.toMatch(/[(;]/);
    }
  });

  test("the link goes to the source that holds the value, never to AnAge for another source's value", () => {
    for (const s of all) {
      const link = lifespanSourceLink(s);
      const source = s.lifespan!.source;
      if (source === "MitoAge_build1") expect(link, s.slug).toBeNull();
      else {
        expect(link, s.slug).not.toBeNull();
        expect(link!.href.includes("senescence.info"), s.slug).toBe(source === "AnAge");
        expect(link!.label.startsWith(lifespanSourceName(source).split(" ")[0]!), s.slug).toBe(true);
      }
    }
  });

  test("FishBase and SeaLifeBase links spell the binomial with a hyphen", () => {
    const fish = all.find((s) => s.lifespan?.source === "FishBase")!;
    const [genus, epithet] = fish.scientificName.split(" ");
    expect(lifespanSourceLink(fish)!.href).toBe(`https://www.fishbase.se/summary/${genus}-${epithet}.html`);
  });

  test("non-commercial is exactly the FishBase and SeaLifeBase values", () => {
    for (const s of all) {
      const nc = s.lifespan!.source === "FishBase" || s.lifespan!.source === "SeaLifeBase";
      expect(isNonCommercial(s.lifespan), s.slug).toBe(nc);
    }
    expect(isNonCommercial(undefined)).toBe(false);
  });

  test("every record status and every review flag in the data has words", () => {
    for (const st of RECORD_STATUSES) expect(recordStatusLabel(st)).toBeTruthy();
    const flags = new Set(all.flatMap((s) => s.reviewFlags ?? []));
    expect(flags.size).toBeGreaterThan(0);
    for (const f of flags) {
      const text = reviewFlagText(f);
      expect(text, f).not.toContain("_");
      expect(text.endsWith("."), f).toBe(true);
    }
    expect(reviewFlagText("some_new_kind:x")).toBe("some new kind:x");
  });
});
