/** AnAge (Human Ageing Genomic Resources) life-history traits. */
import { cachedDownload } from "../lib/cache";
import { ANAGE_PINNED } from "./pinned";
import { type SourceObservation, asQuality, collapse } from "./observation";
import { parseRecords } from "../lib/csv";
import { readZip } from "../lib/zip";
import type { Traits } from "../../src/data/schema";

export const ANAGE_URL = "https://genomics.senescence.info/species/dataset.zip";
export const ANAGE_LICENSE = ANAGE_PINNED.license;

export interface AnAgeEntry {
  hagrid: string;
  scientificName: string;
  commonName: string;
  class: string;
  maxLongevityYears: number | null;
  traits: Omit<Traits, "source">;
  dataQuality: string;
  kingdom: string;
  phylum: string;
  order: string;
  family: string;
  genus: string;
  sampleSize: string;
  specimenOrigin: string;
  sourceText: string;
  references: string;
}

export interface AnAge {
  build: string;
  releaseDate: string;
  md5: string;
  entries: AnAgeEntry[];
}

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

export async function loadAnAge(): Promise<AnAge> {
  const bytes = await cachedDownload(ANAGE_PINNED.path, ANAGE_URL);
  const md5 = new Bun.CryptoHasher("md5").update(bytes).digest("hex");
  // Build 2 is pinned to AnAge build 15: a different dataset.zip (a new AnAge build) must be a deliberate change.
  if (md5 !== ANAGE_PINNED.md5) {
    throw new Error(`data/cache/${ANAGE_PINNED.path} has md5 ${md5}, pinned ${ANAGE_PINNED.version} is ${ANAGE_PINNED.md5}`);
  }
  const zip = readZip(bytes);
  const data = zip.find((e) => e.name.endsWith("anage_data.txt"));
  const release = zip.find((e) => e.name.endsWith("release.html"));
  if (!data) throw new Error("anage_data.txt not found in AnAge zip");
  const releaseText = release ? new TextDecoder().decode(release.data).replace(/<[^>]*>/g, " ") : "";
  const build = /AnAge\s+(Build\s+\d+)/i.exec(releaseText)?.[1] ?? "unknown build";
  const releaseDate = /Release date:\s*([A-Za-z]+\s+\d+,\s*\d{4})/.exec(releaseText)?.[1] ?? "unknown";

  const { records } = parseRecords(new TextDecoder().decode(data.data), "\t");
  const entries = records.map((r) => ({
    hagrid: r["HAGRID"]!,
    scientificName: collapse(`${r["Genus"]} ${r["Species"]}`),
    commonName: r["Common name"] ?? "",
    class: r["Class"] ?? "",
    maxLongevityYears: num(r["Maximum longevity (yrs)"]),
    dataQuality: r["Data quality"] ?? "",
    kingdom: r["Kingdom"] ?? "",
    phylum: r["Phylum"] ?? "",
    order: r["Order"] ?? "",
    family: r["Family"] ?? "",
    genus: r["Genus"] ?? "",
    sampleSize: r["Sample size"] ?? "",
    specimenOrigin: r["Specimen origin"] ?? "",
    sourceText: r["Source"] ?? "",
    references: r["References"] ?? "",
    traits: {
      adultWeightG: num(r["Adult weight (g)"]),
      birthWeightG: num(r["Birth weight (g)"]),
      metabolicRateW: num(r["Metabolic rate (W)"]),
      bodyTemperatureK: num(r["Temperature (K)"]),
      femaleMaturityDays: num(r["Female maturity (days)"]),
      maleMaturityDays: num(r["Male maturity (days)"]),
      gestationDays: num(r["Gestation/Incubation (days)"]),
      litterSize: num(r["Litter/Clutch size"]),
      littersPerYear: num(r["Litters/Clutches per year"]),
      growthRatePerDay: num(r["Growth rate (1/days)"]),
    },
  }));
  return { build, releaseDate, md5, entries };
}

/** Every animal entry as a lifespan observation (entries without a value are kept for name matching). */
export function anageObservations(a: AnAge): SourceObservation[] {
  return a.entries
    .filter((e) => e.kingdom === "Animalia")
    .map((e) => ({
      source: "AnAge" as const,
      sourceVersion: ANAGE_PINNED.version,
      sourceRecordId: e.hagrid,
      sourceName: e.scientificName,
      sourceCommonName: e.commonName || null,
      valueYears: e.maxLongevityYears,
      recordType: e.specimenOrigin === "wild" ? ("wild" as const) : e.specimenOrigin === "captivity" ? ("captive" as const) : ("observed" as const),
      quality: asQuality(e.dataQuality),
      sampleSizeText: e.sampleSize || null,
      sex: null,
      detail: `specimen origin=${e.specimenOrigin}; source=${e.sourceText}`,
      reference: e.references || null,
      license: ANAGE_PINNED.license,
      speccode: null,
      aquatic: null,
    }));
}
