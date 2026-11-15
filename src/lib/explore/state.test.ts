import { describe, expect, test } from "bun:test";
import { getAllSpecies, getBuildInfo, getFeatureDefs, getFeatureValues } from "~/data";
import { buildExplorer } from "../../../pipeline/steps/explorer";
import { buildExtendedDefs, isExtendedFeature, REPEAT_MIN_LENGTH } from "../../../pipeline/steps/extended";
import { HOMOPOLYMER_MIN, STR_MIN_UNITS, TRACT_MIN } from "../../../pipeline/lib/motifs";
import { DEFAULT_STATE, parseState, serializeState } from "./state";
import { assertCatalogMatchesData, buildChunk, chunkSpecs } from "./build";
import {
  axisTitle,
  EXTENDED_THRESHOLDS,
  FEATURE_KEYS,
  getVariable,
  GROUP_LABEL,
  isExtendedVar,
  regionPickerLabel,
  TRAIT_KEYS,
} from "./variables";

const isVar = (k: string) => getVariable(k) !== undefined;
const defaultLog = (k: string) => getVariable(k)?.defaultLog ?? false;

describe("variable catalogue", () => {
  test("feature keys match the pipeline's feature list exactly", () => {
    const ours = FEATURE_KEYS();
    const theirs = getFeatureDefs().map((d) => d.key);
    expect(new Set(ours).size).toBe(ours.length);
    expect([...ours].sort()).toEqual([...theirs].sort());
    expect(() => assertCatalogMatchesData()).not.toThrow();
  });

  test("the extended features are exactly the pipeline's, on both sides of the payload split", () => {
    const extended = FEATURE_KEYS().filter((k) => isExtendedVar(getVariable(k)!));
    expect([...extended].sort()).toEqual(buildExtendedDefs().map((d) => d.key).sort());
    for (const k of FEATURE_KEYS()) expect([k, isExtendedFeature(k)]).toEqual([k, isExtendedVar(getVariable(k)!)]);
  });

  test("every feature has a name, a family and a region label, never its raw key", () => {
    for (const k of FEATURE_KEYS()) {
      const v = getVariable(k)!;
      if (v.kind !== "feature") throw new Error(k);
      expect(v.label).not.toBe(k);
      expect(v.label).not.toContain(":");
      expect(v.short).not.toContain(":");
      expect(GROUP_LABEL[v.group]).toBeTruthy();
      expect(regionPickerLabel(v.region)).not.toMatch(/_/);
    }
  });

  test("labels", () => {
    expect(TRAIT_KEYS.length).toBe(11);
    expect(getVariable("gc:ND6")?.label).toBe("GC content of ND6");
    expect(getVariable("codon:total_pc:CUA")?.short).toBe("Protein-coding CUA (Leu)");
    expect(getVariable("aa:ND1:L")?.label).toBe("Leucine (Leu) in ND1");
    expect(getVariable("gravy:total_pc")?.label).toBe("Protein hydropathy (GRAVY) of all protein-coding genes");
    expect(getVariable("ff:ND2:U")?.label).toBe("U at fourfold-degenerate sites of ND2 (gene sense)");
    expect(getVariable("ffH:major12:G")?.short).toBe("All but ND6 4-fold G (H)");
    expect(getVariable("repeats:direct:major_arc")?.label).toBe("Perfect direct repeats ≥ 10 bp in the major arc");
    expect(axisTitle(getVariable("ff:ND2:U")!, false)).toBe("ND2 4-fold U, % of fourfold sites");
    expect(axisTitle(getVariable("maxLongevityYears")!, true)).toBe("Max lifespan, years (log scale)");
    expect(getVariable("maxLongevityYears")?.defaultLog).toBe(true);
    expect(getVariable("bodyTemperatureK")?.defaultLog).toBe(false);
  });

  test("the thresholds in the labels are the pipeline's", () => {
    expect(EXTENDED_THRESHOLDS).toEqual({
      repeatMinBp: REPEAT_MIN_LENGTH,
      tractMinBp: TRACT_MIN,
      homopolymerMinBp: HOMOPOLYMER_MIN,
      strMinUnits: STR_MIN_UNITS,
    });
  });
});

describe("payload and chunks", () => {
  const species = getAllSpecies();
  const payload = buildExplorer(species, getFeatureDefs(), new Map(), getBuildInfo()) as { features: { key: string }[] };
  const specs = chunkSpecs();
  const chunks = new Map(specs.map((s) => [s.name, buildChunk(s)]));

  test("every feature is in explorer.json or in exactly one chunk, never both", () => {
    const inPayload = new Set(payload.features.map((f) => f.key));
    const inChunk = new Map<string, number>();
    for (const c of chunks.values()) for (const k of c.keys) inChunk.set(k, (inChunk.get(k) ?? 0) + 1);
    for (const k of getFeatureDefs().map((d) => d.key)) {
      expect({ k, places: (inPayload.has(k) ? 1 : 0) + (inChunk.get(k) ?? 0) }).toEqual({ k, places: 1 });
    }
    expect(inPayload.size + inChunk.size).toBe(getFeatureDefs().length);
    // explorer.json carries no extended feature (RM2): they are all in chunks
    expect(payload.features.some((f) => isExtendedFeature(f.key))).toBe(false);
  });

  test("an extended chunk carries the data's values, aligned by species id", () => {
    const c = chunks.get("nd2-ext")!;
    expect(c.keys).toContain("ff:ND2:U");
    expect(c.ids).toEqual(species.map((s) => s.id));
    for (const key of ["ff:ND2:U", "gravy:ND2"]) {
      const byId = getFeatureValues(key);
      const row = c.values[c.keys.indexOf(key)]!;
      const expected = c.ids.map((id) => {
        const v = byId[id];
        return v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000;
      });
      expect(row).toEqual(expected);
      expect(row.some((v) => v !== null)).toBe(true);
    }
    const arc = chunks.get("major-arc-ext")!;
    expect(arc.keys).toContain("size:major_arc");
  });
});

describe("URL state", () => {
  test("defaults", () => {
    expect(parseState("", isVar)).toEqual(DEFAULT_STATE);
    expect(parseState("?x=nonsense&y=gc:XYZ&scope=bogus!", isVar)).toEqual(DEFAULT_STATE);
  });

  test("links from species, taxon and gene pages", () => {
    const s = parseState("?highlight=homo-sapiens", isVar);
    expect(s.highlight).toEqual(["homo-sapiens"]);
    const g = parseState("?x=maxLongevityYears&y=gc:ND6", isVar);
    expect(g.x).toBe("maxLongevityYears");
    expect(g.y).toBe("gc:ND6");
  });

  test("round trip keeps the view", () => {
    const s = {
      x: "adultWeightG",
      y: "codon:ND6:CUA",
      logX: false,
      logY: true,
      scope: "class:Mammalia",
      highlight: ["homo-sapiens", "mus-musculus"],
      fit: true,
    };
    const q = serializeState(s, defaultLog);
    expect(q).toBe(
      "?x=adultWeightG&y=codon:ND6:CUA&logx=0&logy=1&scope=class:Mammalia&highlight=homo-sapiens,mus-musculus&fit=1",
    );
    expect(parseState(q, isVar)).toEqual(s);
  });

  test("default log flags are left out of the link", () => {
    const q = serializeState(
      { ...DEFAULT_STATE, x: "maxLongevityYears", y: "gc:total_mtDNA", logX: true, logY: false },
      defaultLog,
    );
    expect(q).toBe("?x=maxLongevityYears&y=gc:total_mtDNA");
    expect(serializeState({ ...DEFAULT_STATE, logX: false, logY: false }, defaultLog)).toBe(
      "?x=gc:total_mtDNA&y=gcSkew:total_mtDNA",
    );
  });

  test("highlights are cleaned and capped", () => {
    const s = parseState("?highlight=Homo-Sapiens,,bad slug,homo-sapiens,a,b,c,d,e,f,g,h,i", isVar);
    expect(s.highlight[0]).toBe("homo-sapiens");
    expect(s.highlight.length).toBe(8);
  });
});
