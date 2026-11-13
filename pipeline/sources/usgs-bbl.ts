/**
 * USGS Bird Banding Laboratory longevity records (pinned: NABBP v2025.1). Each row is the oldest
 * banded individual of a species: a wild minimum age, which usually underestimates the maximum.
 */
import { parseRecords } from "../lib/csv";
import { USGS_BBL, requirePinned } from "./pinned";
import { type SourceObservation, collapse } from "./observation";

/** "12 years 07 months" -> 12.5833; null when the text does not have that form. */
export function parseBblAge(s: string): number | null {
  const m = /^\s*(\d+)\s*years?\s*(\d+)\s*months?/.exec(s);
  return m ? Number(m[1]) + Number(m[2]) / 12 : null;
}

export async function loadUsgsBbl(): Promise<SourceObservation[]> {
  const { records } = parseRecords(await Bun.file(requirePinned(USGS_BBL)).text());
  return records.map((r, i) => ({
    source: "USGS_BBL" as const,
    sourceVersion: USGS_BBL.version,
    sourceRecordId: `usgs2025:${i}`,
    sourceName: collapse(r["Scientific Name"]),
    sourceCommonName: r["Species Name"] || null,
    valueYears: parseBblAge(r["Minimum age at encounter"] ?? ""),
    recordType: "wild" as const,
    quality: "acceptable" as const,
    sampleSizeText: "single individual (oldest banded bird; minimum age)",
    sex: r["Sex"] || null,
    detail: `min age ${r["Minimum age at encounter"]}; banded ${r["Banding date"]} ${r["Banding region"]} (${r["Age at banding"]}); encountered ${r["Encounter date"]} ${r["Encounter region"]}; ${r["How bird and band were obtained"]}`,
    reference: "NABBP longevity table",
    license: USGS_BBL.license,
    speccode: null,
    aquatic: null,
  }));
}
