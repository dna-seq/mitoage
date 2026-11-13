import { describe, expect, test } from "bun:test";
import { getFeatureDefs } from "~/data";
import { DEFAULT_STATE, parseState, serializeState } from "./state";
import { axisTitle, FEATURE_KEYS, getVariable, TRAIT_KEYS } from "./variables";

const isVar = (k: string) => getVariable(k) !== undefined;
const defaultLog = (k: string) => getVariable(k)?.defaultLog ?? false;

describe("variable catalogue", () => {
  test("feature keys match the pipeline's feature list exactly", () => {
    const ours = FEATURE_KEYS();
    const theirs = getFeatureDefs().map((d) => d.key);
    expect(ours.length).toBe(1257);
    expect(new Set(ours).size).toBe(ours.length);
    expect([...ours].sort()).toEqual([...theirs].sort());
  });

  test("labels", () => {
    expect(TRAIT_KEYS.length).toBe(11);
    expect(getVariable("gc:ND6")?.label).toBe("GC content of ND6");
    expect(getVariable("codon:total_pc:CUA")?.short).toBe("Protein-coding CUA (Leu)");
    expect(getVariable("aa:ND1:L")?.label).toBe("Leucine (Leu) in ND1");
    expect(axisTitle(getVariable("maxLongevityYears")!, true)).toBe("Max lifespan, years (log scale)");
    expect(getVariable("maxLongevityYears")?.defaultLog).toBe(true);
    expect(getVariable("bodyTemperatureK")?.defaultLog).toBe(false);
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
