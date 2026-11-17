import { describe, expect, test } from "bun:test";
import { type NamedSpecies, type SourceSynonyms, synonymPairs } from "../steps/synonym-pairs";

const sp = (id: number, scientificName: string, taxid: number | null = id * 10): NamedSpecies => ({ id, scientificName, taxid, refseq: `NC_${id}.1` });

const cod = sp(1, "Gadus macrocephalus");
const ogac = sp(2, "Gadus ogac");
const morhua = sp(3, "Gadus morhua");
const clam = sp(4, "Panopea generosa");
const abrupta = sp(5, "Panopea abrupta");
const all = [cod, ogac, morhua, clam, abrupta];

const fishbase = (rows: [number, string, string][]): SourceSynonyms => {
  const m = new Map<number, { name: string; status: string }[]>();
  for (const [code, name, status] of rows) (m.get(code) ?? m.set(code, []).get(code)!).push({ name, status });
  return new Map([["FishBase", m]]);
};

const names = (pairs: ReturnType<typeof synonymPairs>) => pairs.map((p) => `${p.by}: ${p.a.scientificName} / ${p.b.scientificName}`);

describe("possible duplicate species by names", () => {
  test("nothing is listed when no taxonomy joins two names", () => {
    expect(synonymPairs(all, new Map(), new Map())).toEqual([]);
    expect(synonymPairs(all, new Map([[cod.taxid!, ["Gadus pallasii"]]]), fishbase([[308, "Gadus macrocephalus", "accepted name"], [69, "Gadus morhua", "accepted name"]]))).toEqual([]);
    expect(synonymPairs([], new Map([[10, ["Gadus ogac"]]]), fishbase([[308, "Gadus ogac", "synonym"]]))).toEqual([]);
  });

  test("a source's species record with both names gives the pair, once, in name order", () => {
    const src = fishbase([[308, "Gadus ogac", "synonym"], [308, "Gadus macrocephalus", "synonym"], [308, "Gadus macrocephalus", "accepted name"], [308, "Gadus macrocephalus", "synonym"], [69, "Gadus morhua", "accepted name"]]);
    const pairs = synonymPairs(all, new Map(), src);
    expect(names(pairs)).toEqual(["FishBase: Gadus macrocephalus / Gadus ogac"]);
    expect(pairs[0]!.detail).toBe("FishBase keeps both names under one species (SpecCode 308): Gadus macrocephalus as accepted name, Gadus ogac as synonym");
    // the species' order in the input does not move the result
    expect(synonymPairs([...all].reverse(), new Map(), src)).toEqual(pairs);
  });

  test("a misapplied name and an ambiguous synonym join nothing", () => {
    for (const status of ["misapplied name", "ambiguous synonym", ""]) {
      expect(synonymPairs(all, new Map(), fishbase([[308, "Gadus ogac", status], [308, "Gadus macrocephalus", "accepted name"]]))).toEqual([]);
    }
  });

  test("names are compared as the matcher compares them: case, quotes and parenthesised parts aside", () => {
    const src = fishbase([[308, "gadus  OGAC", "synonym"], [308, "Gadus (Gadus) macrocephalus", "accepted name"]]);
    expect(names(synonymPairs(all, new Map(), src))).toEqual(["FishBase: Gadus macrocephalus / Gadus ogac"]);
  });

  test("an NCBI synonym of one species that is the name of another gives the pair", () => {
    const pairs = synonymPairs(all, new Map([[clam.taxid!, ["Panope generosa", "Panopea abrupta"]], [morhua.taxid!, ["Gadus callarias"]]]), new Map());
    expect(names(pairs)).toEqual(["NCBI: Panopea abrupta / Panopea generosa"]);
    expect(pairs[0]!.detail).toBe(`NCBI lists Panopea abrupta as a synonym of Panopea generosa (taxid ${clam.taxid})`);
  });

  test("a species' own name among its synonyms is no pair; a species without a taxid is skipped for NCBI only", () => {
    expect(synonymPairs(all, new Map([[cod.taxid!, ["Gadus macrocephalus"]]]), new Map())).toEqual([]);
    const noTaxid = sp(6, "Gadus ogac", null);
    const src = fishbase([[308, "Gadus ogac", "synonym"], [308, "Gadus macrocephalus", "accepted name"]]);
    expect(names(synonymPairs([cod, noTaxid], new Map([[cod.taxid!, ["Gadus ogac"]]]), src))).toEqual(["FishBase: Gadus macrocephalus / Gadus ogac", "NCBI: Gadus macrocephalus / Gadus ogac"]);
    expect(synonymPairs([cod, noTaxid], new Map([[0, ["Gadus macrocephalus"]]]), new Map())).toEqual([]);
  });

  test("two taxonomies that both join a pair list it once each; three names under one record give three pairs", () => {
    const src = fishbase([[308, "Gadus ogac", "synonym"], [308, "Gadus macrocephalus", "accepted name"], [308, "Gadus morhua", "synonym"]]);
    const pairs = synonymPairs(all, new Map([[cod.taxid!, ["Gadus ogac"]], [ogac.taxid!, ["Gadus macrocephalus"]]]), src);
    expect(names(pairs)).toEqual([
      "FishBase: Gadus macrocephalus / Gadus morhua",
      "FishBase: Gadus macrocephalus / Gadus ogac",
      "FishBase: Gadus morhua / Gadus ogac",
      "NCBI: Gadus macrocephalus / Gadus ogac",
    ]);
  });

  test("sources are reported in name order whatever the map's order", () => {
    const fb = fishbase([[308, "Gadus ogac", "synonym"], [308, "Gadus macrocephalus", "accepted name"]]).get("FishBase")!;
    const slb = fishbase([[7, "Panopea abrupta", "synonym"], [7, "Panopea generosa", "accepted name"]]).get("FishBase")!;
    const one = synonymPairs(all, new Map(), new Map([["SeaLifeBase", slb], ["FishBase", fb]]));
    const two = synonymPairs(all, new Map(), new Map([["FishBase", fb], ["SeaLifeBase", slb]]));
    expect(names(one)).toEqual(["FishBase: Gadus macrocephalus / Gadus ogac", "SeaLifeBase: Panopea abrupta / Panopea generosa"]);
    expect(two).toEqual(one);
  });
});
