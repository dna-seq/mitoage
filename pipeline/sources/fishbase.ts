/**
 * FishBase and SeaLifeBase (pinned parquet snapshots v26.06, CC BY-NC 4.0). Both databases share
 * one schema, so one reader serves both; sources/sealifebase.ts binds it to SeaLifeBase.
 *
 * Values read: popchar.tmax (reported maximum age, record type "observed"; tmaxQuality -1 ->
 * "questionable"), species.LongevityWild ("wild"), species.LongevityCaptive ("captive"), and
 * popgrowth.tmax ("estimated" from a growth study, quality "low").
 */
import { readParquet } from "../lib/parquet";
import { FISHBASE, type PinnedSource, requirePinned } from "./pinned";
import { type SourceObservation, collapse } from "./observation";

export interface FishBaseLike {
  source: "FishBase" | "SeaLifeBase";
  observations: SourceObservation[];
  /** SpecCode -> synonym name keys with their status (species-level synonyms only). */
  synonyms: Map<number, { name: string; status: string }[]>;
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const text = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export async function loadFishBaseLike(pin: PinnedSource, source: "FishBase" | "SeaLifeBase"): Promise<FishBaseLike> {
  const dir = requirePinned(pin);
  const file = (t: string) => requirePinned(pin, `${t}.parquet`);
  void dir;
  const species = await readParquet(file("species"), [
    "SpecCode", "Genus", "Species", "FBname", "FamCode", "Fresh", "Brack", "Saltwater",
    "LongevityWild", "LongevityWildRef", "LongevityCaptive", "LongevityCapRef",
  ]);
  const byCode = new Map<number, { name: string; common: string | null; aquatic: boolean }>();
  for (const r of species) {
    byCode.set(Number(r["SpecCode"]), {
      name: collapse(`${String(r["Genus"] ?? "").trim()} ${String(r["Species"] ?? "").trim()}`),
      common: text(r["FBname"]),
      aquatic: [r["Fresh"], r["Brack"], r["Saltwater"]].some((v) => Number(v) === 1),
    });
  }
  const obs: SourceObservation[] = [];
  const base = (code: number) => {
    const s = byCode.get(code)!;
    return {
      source,
      sourceVersion: pin.version,
      sourceName: s.name,
      sourceCommonName: s.common,
      license: pin.license,
      speccode: code,
      aquatic: source === "SeaLifeBase" ? s.aquatic : null,
    };
  };
  const popchar = await readParquet(file("popchar"));
  for (const r of popchar) {
    const code = Number(r["Speccode"]);
    const v = num(r["tmax"]);
    if (v === null || !byCode.has(code)) continue;
    const q = num(r["tmaxQuality"]) ?? 0;
    obs.push({
      ...base(code),
      sourceRecordId: `popchar:${r["Autoctr"]}`,
      valueYears: v,
      recordType: "observed",
      quality: q === -1 ? "questionable" : "acceptable",
      sampleSizeText: null,
      sex: text(r["Sex"]),
      detail: `popchar tmax; locality=${r["Locality"] ?? ""}; tmaxQuality=${q}`,
      reference: text(r["PopCharRefNo"]),
    });
  }
  for (const [col, rt, ref] of [
    ["LongevityWild", "wild", "LongevityWildRef"],
    ["LongevityCaptive", "captive", "LongevityCapRef"],
  ] as const) {
    for (const r of species) {
      const v = num(r[col]);
      if (v === null) continue;
      const code = Number(r["SpecCode"]);
      obs.push({
        ...base(code),
        sourceRecordId: `species.${col}:${code}`,
        valueYears: v,
        recordType: rt,
        quality: "acceptable",
        sampleSizeText: null,
        sex: null,
        detail: `species.${col}`,
        reference: text(r[ref]),
      });
    }
  }
  const popgrowth = await readParquet(file("popgrowth"));
  for (const r of popgrowth) {
    const code = Number(r["SpecCode"]);
    const v = num(r["tmax"]);
    if (v === null || !byCode.has(code)) continue;
    const n = num(r["Number"]);
    obs.push({
      ...base(code),
      sourceRecordId: `popgrowth:${r["AutoCtr"]}`,
      valueYears: v,
      recordType: "estimated",
      quality: "low",
      sampleSizeText: n === null ? null : `n=${Math.trunc(n)}`,
      sex: text(r["Sex"]),
      detail: `popgrowth tmax (from growth study; data=${r["Data"] ?? ""}; K=${r["K"] ?? ""}; Loo=${r["Loo"] ?? ""})`,
      reference: text(r["tmaxRef"]),
    });
  }
  const synonyms = new Map<number, { name: string; status: string }[]>();
  for (const r of await readParquet(file("synonyms"), ["SpecCode", "SynGenus", "SynSpecies", "TaxonLevel", "Status"])) {
    const level = String(r["TaxonLevel"] ?? "").toLowerCase();
    if (!["species", "subspecies", "nominotypical"].includes(level)) continue;
    const code = Number(r["SpecCode"]);
    const list = synonyms.get(code) ?? [];
    list.push({ name: `${r["SynGenus"] ?? ""} ${r["SynSpecies"] ?? ""}`, status: String(r["Status"] ?? "") });
    synonyms.set(code, list);
  }
  return { source, observations: obs, synonyms };
}

export const loadFishBase = () => loadFishBaseLike(FISHBASE, "FishBase");
