import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { anageObservations, loadAnAge } from "../sources/anage";
import { loadFishBase } from "../sources/fishbase";
import type { SourceObservation } from "../sources/observation";
import { FISHBASE, SEALIFEBASE, cacheFile } from "../sources/pinned";
import { loadSeaLifeBase } from "../sources/sealifebase";
import { parseBblAge } from "../sources/usgs-bbl";
import { type MatchedObservation, PRECEDENCE, chooseLifespan, harmonisedClass, matchSourceNames, recKey, taxonGroup } from "../steps/lifespan";

const LINEAGES = {
  human: "Eukaryota; Metazoa; Chordata; Craniata; Vertebrata; Euteleostomi; Mammalia; Eutheria; Euarchontoglires; Primates; Haplorrhini; Catarrhini; Hominidae; Homo",
  chicken: "Eukaryota; Metazoa; Chordata; Craniata; Vertebrata; Euteleostomi; Archelosauria; Archosauria; Dinosauria; Saurischia; Theropoda; Coelurosauria; Aves; Neognathae; Galloanserae; Galliformes; Phasianidae; Phasianinae; Gallus",
  cod: "Eukaryota; Metazoa; Chordata; Craniata; Vertebrata; Euteleostomi; Actinopterygii; Neopterygii; Teleostei; Neoteleostei; Acanthomorphata; Zeiogadaria; Gadariae; Gadiformes; Gadoidei; Gadidae; Gadus",
  turtle: "Eukaryota; Metazoa; Chordata; Craniata; Vertebrata; Euteleostomi; Archelosauria; Testudinata; Testudines; Cryptodira; Durocryptodira; Testudinoidea; Emydidae; Trachemys",
  lancelet: "Eukaryota; Metazoa; Chordata; Cephalochordata; Leptocardii; Amphioxiformes; Branchiostomatidae; Branchiostoma",
  lamprey: "Eukaryota; Metazoa; Chordata; Craniata; Vertebrata; Cyclostomata; Hyperoartia; Petromyzontiformes; Petromyzontidae; Petromyzon",
  oyster: "Eukaryota; Metazoa; Spiralia; Lophotrochozoa; Mollusca; Bivalvia; Autobranchia; Pteriomorphia; Ostreida; Ostreoidea; Ostreidae; Crassostrea",
};

describe("taxon groups and the build 1 class scheme", () => {
  test("groups", () => {
    expect(taxonGroup(LINEAGES.human)).toBe("other_vertebrate");
    expect(taxonGroup(LINEAGES.chicken)).toBe("bird");
    expect(taxonGroup(LINEAGES.cod)).toBe("fish");
    expect(taxonGroup(LINEAGES.lamprey)).toBe("fish");
    expect(taxonGroup(LINEAGES.lancelet)).toBe("invertebrate");
    expect(taxonGroup(LINEAGES.oyster)).toBe("invertebrate");
  });
  test("classes stay in the 2016 scheme", () => {
    expect(harmonisedClass(LINEAGES.cod, "")).toBe("Actinopterygii");
    expect(harmonisedClass(LINEAGES.turtle, "")).toBe("Reptilia");
    expect(harmonisedClass(LINEAGES.chicken, "Aves")).toBe("Aves");
    expect(harmonisedClass(LINEAGES.oyster, "Bivalvia")).toBe("Bivalvia");
    expect(harmonisedClass(LINEAGES.oyster, "")).toBeNull();
    expect(harmonisedClass(LINEAGES.lamprey, "Hyperoartia")).toBe("Cephalaspidomorphi");
  });
  test("priority table: AnAge first everywhere, secondary sources only for their taxa", () => {
    for (const g of Object.values(PRECEDENCE)) expect(g[0]).toBe("AnAge");
    expect(PRECEDENCE.bird).toEqual(["AnAge", "EURING", "USGS_BBL"]);
    expect(PRECEDENCE.other_vertebrate).toEqual(["AnAge"]);
  });
  test("USGS ages", () => {
    expect(parseBblAge("12 years 07 months")).toBeCloseTo(12 + 7 / 12, 12);
    expect(parseBblAge("1 year 0 months")).toBe(1);
    expect(parseBblAge("unknown")).toBeNull();
  });
});

const asMatched = (o: SourceObservation, t = 1): MatchedObservation => ({ ...o, speciesTaxid: t, matchMethod: "test" });

describe.skipIf(!existsSync(cacheFile(FISHBASE)) || !existsSync(cacheFile(SEALIFEBASE)))("precedence on real source rows", async () => {
  const fb = await loadFishBase();
  const slb = await loadSeaLifeBase();
  const anage = await loadAnAge();
  const cod = fb.observations.filter((o) => o.sourceName === "Gadus morhua").map((o) => asMatched(o));
  const codAnAge = anageObservations(anage).filter((o) => o.sourceName === "Gadus morhua").map((o) => asMatched(o));

  test("fixture has FishBase values of several kinds", () => {
    expect(cod.length).toBeGreaterThan(3);
    expect(codAnAge.length).toBe(1);
  });
  test("fish without AnAge: the maximum reported FishBase value of acceptable quality", () => {
    const reported = cod.filter((o) => o.recordType !== "estimated" && o.quality !== "questionable");
    const expected = Math.max(...reported.map((o) => o.valueYears!));
    const got = chooseLifespan(cod, "fish");
    expect(got?.source).toBe("FishBase");
    expect(got?.valueYears).toBe(expected);
    // An estimate larger than every reported value is not chosen.
    const bigEstimate = { ...cod.find((o) => o.recordType === "estimated") ?? cod[0]!, recordType: "estimated" as const, quality: "low" as const, valueYears: expected + 100 };
    expect(chooseLifespan([...cod, bigEstimate], "fish")?.valueYears).toBe(expected);
    // So is a reported value flagged questionable.
    const questionable = { ...reported[0]!, quality: "questionable" as const, valueYears: expected + 50 };
    expect(chooseLifespan([...cod, questionable], "fish")?.valueYears).toBe(expected);
    expect(chooseLifespan([questionable], "fish")?.valueYears).toBe(expected + 50);
  });
  test("equal maxima: the value with a stated specimen origin wins", () => {
    const observed = cod.find((o) => o.recordType === "observed")!;
    const wild = { ...(cod.find((o) => o.recordType === "wild") ?? observed), recordType: "wild" as const, sourceRecordId: "species.LongevityWild:test" };
    const top = Math.max(...cod.filter((o) => o.recordType !== "estimated" && o.quality !== "questionable").map((o) => o.valueYears!)) + 1;
    const a = { ...observed, valueYears: top };
    const b = { ...wild, valueYears: top, quality: "acceptable" as const };
    expect(chooseLifespan([...cod, a, b], "fish")?.sourceRecordId).toBe("species.LongevityWild:test");
    expect(chooseLifespan([...cod, b, a], "fish")?.sourceRecordId).toBe("species.LongevityWild:test");
  });
  test("estimates only when nothing is reported", () => {
    const est = cod.filter((o) => o.recordType === "estimated");
    if (est.length === 0) return;
    expect(chooseLifespan(est, "fish")?.valueYears).toBe(Math.max(...est.map((o) => o.valueYears!)));
  });
  test("AnAge wins even with a smaller value", () => {
    const anageValue = codAnAge[0]!.valueYears!;
    const lower = { ...codAnAge[0]!, valueYears: Math.min(anageValue, ...cod.map((o) => o.valueYears!)) - 1 };
    expect(chooseLifespan([...cod, lower], "fish")?.source).toBe("AnAge");
    expect(chooseLifespan([...cod, lower], "fish")?.valueYears).toBe(lower.valueYears);
  });
  test("a source outside the taxon's priority list is never used", () => {
    expect(chooseLifespan(cod, "bird")).toBeNull();
    expect(chooseLifespan(cod, "other_vertebrate")).toBeNull();
    expect(chooseLifespan(cod, "invertebrate")).toBeNull();
  });
  test("SeaLifeBase only for aquatic species", () => {
    const withValue = slb.observations.filter((o) => o.valueYears !== null && o.recordType !== "estimated" && o.quality !== "questionable");
    const aquatic = withValue.find((o) => o.aquatic === true)!;
    const dry = { ...aquatic, aquatic: false };
    expect(chooseLifespan([asMatched(aquatic)], "invertebrate")?.valueYears).toBe(aquatic.valueYears);
    expect(chooseLifespan([asMatched(dry)], "invertebrate")).toBeNull();
    expect(chooseLifespan([asMatched(aquatic)], "fish")).toBeNull();
  });
});

describe("name matching", () => {
  const obs = (source: SourceObservation["source"], sourceName: string, speccode: number | null = null): SourceObservation => ({
    source, sourceVersion: "v", sourceRecordId: sourceName, sourceName, sourceCommonName: null, valueYears: 1, recordType: "observed",
    quality: "acceptable", sampleSizeText: null, sex: null, detail: null, reference: null, license: "l", speccode, aquatic: null,
  });
  const tax = {
    sci: new Map([["gadus morhua", [8049]], ["spinus spinus", [160760]], ["canis lupus", [9612]], ["aotus azarai", [30591]], ["two names", [1, 2]]]),
    syn: new Map([["carduelis spinus", [160760]], ["aotus azarae", [30591]]]),
  };
  const syn = new Map([["FishBase", new Map([[69, [{ name: "Morhua vulgaris", status: "synonym" }, { name: "Gadus morhua", status: "accepted name" }]], [70, [{ name: "Gadus morhua", status: "misapplied name" }]]])]]);
  syn.get("FishBase")!.set(71, [{ name: "Gadus  morhua", status: "synonym" }]);

  test("order of evidence and the result of each", () => {
    const list = [
      obs("AnAge", "Gadus morhua"),
      obs("AnAge", "Carduelis spinus"),
      obs("AnAge", "Canis lupus familiaris"),
      obs("AnAge", "Two names"),
      obs("AnAge", "Nothing here"),
      obs("FishBase", "Morhua vulgaris", 69),
      obs("FishBase", "Morhua misapplied", 70),
    ];
    const m = matchSourceNames(list, tax, syn);
    const get = (s: SourceObservation) => m.get(recKey(s.source, s.sourceName, s.speccode))!;
    expect(get(list[0]!)).toMatchObject({ method: "ncbi_scientific_name", speciesTaxid: 8049, status: "ok" });
    expect(get(list[1]!)).toMatchObject({ method: "ncbi_synonym", speciesTaxid: 160760, status: "ok" });
    expect(get(list[2]!)).toMatchObject({ method: "binomial_of_trinomial", speciesTaxid: 9612, status: "ok" });
    expect(get(list[3]!)).toMatchObject({ status: "ambiguous", speciesTaxid: null, candidates: [1, 2] });
    expect(get(list[4]!)).toMatchObject({ status: "unmatched", speciesTaxid: null });
    expect(get(list[5]!)).toMatchObject({ method: "fishbase_synonym", speciesTaxid: 8049, status: "ok" });
    expect(get(list[6]!)).toMatchObject({ status: "unmatched" }); // a misapplied name is not evidence
  });
  test("several records of one source on one species: the strictly better match wins, ties stay ambiguous", () => {
    const a = obs("AnAge", "Aotus azarai");
    const b = obs("AnAge", "Aotus azarae");
    const m = matchSourceNames([a, b], tax, syn);
    expect(m.get(recKey("AnAge", a.sourceName, null))!.status).toBe("ok_conflict_primary");
    expect(m.get(recKey("AnAge", b.sourceName, null))!.status).toBe("conflict_secondary");
    const c = obs("FishBase", "Morhua vulgaris", 69);
    const d = obs("FishBase", "Gadus  morhua x", 71);
    const m2 = matchSourceNames([c, { ...d, sourceName: "Morhua vulgaris", speccode: 71 }], tax, syn);
    for (const v of m2.values()) expect(v.status).toBe("ambiguous_many_to_one");
  });
});
