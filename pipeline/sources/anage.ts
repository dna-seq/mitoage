/** AnAge (Human Ageing Genomic Resources) life-history traits. */
import { cachedDownload } from "../lib/cache";
import { parseRecords } from "../lib/csv";
import { readZip } from "../lib/zip";
import type { Traits } from "../../src/data/schema";

export const ANAGE_URL = "https://genomics.senescence.info/species/dataset.zip";
export const ANAGE_LICENSE =
  "Free to use, subject to the Human Ageing Genomic Resources conditions of use (https://genomics.senescence.info/legal.html); cite Tacutu et al. 2013, Nucleic Acids Res 41:D1027-D1033";

export interface AnAgeEntry {
  hagrid: string;
  scientificName: string;
  commonName: string;
  class: string;
  maxLongevityYears: number | null;
  traits: Omit<Traits, "source">;
  dataQuality: string;
}

export interface AnAge {
  build: string;
  releaseDate: string;
  entries: AnAgeEntry[];
}

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

export async function loadAnAge(): Promise<AnAge> {
  const zip = readZip(await cachedDownload("anage/dataset.zip", ANAGE_URL));
  const data = zip.find((e) => e.name.endsWith("anage_data.txt"));
  const release = zip.find((e) => e.name.endsWith("release.html"));
  if (!data) throw new Error("anage_data.txt not found in AnAge zip");
  const releaseText = release ? new TextDecoder().decode(release.data).replace(/<[^>]*>/g, " ") : "";
  const build = /AnAge\s+(Build\s+\d+)/i.exec(releaseText)?.[1] ?? "unknown build";
  const releaseDate = /Release date:\s*([A-Za-z]+\s+\d+,\s*\d{4})/.exec(releaseText)?.[1] ?? "unknown";

  const { records } = parseRecords(new TextDecoder().decode(data.data), "\t");
  const entries = records.map((r) => ({
    hagrid: r["HAGRID"]!,
    scientificName: `${r["Genus"]} ${r["Species"]}`.trim(),
    commonName: r["Common name"] ?? "",
    class: r["Class"] ?? "",
    maxLongevityYears: num(r["Maximum longevity (yrs)"]),
    dataQuality: r["Data quality"] ?? "",
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
  return { build, releaseDate, entries };
}
