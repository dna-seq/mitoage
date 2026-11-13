/** One lifespan value as read from a source, before species matching. */
import type { LifespanQuality, LifespanRecordType, LifespanSource } from "../../src/data/schema";

export interface SourceObservation {
  source: LifespanSource;
  sourceVersion: string;
  sourceRecordId: string;
  /** Scientific name as written in the source, whitespace collapsed. */
  sourceName: string;
  sourceCommonName: string | null;
  /** Null when the source row has no value (kept for name matching only). */
  valueYears: number | null;
  recordType: LifespanRecordType;
  quality: LifespanQuality | null;
  sampleSizeText: string | null;
  sex: string | null;
  detail: string | null;
  reference: string | null;
  license: string;
  /** FishBase / SeaLifeBase species code. */
  speccode: number | null;
  /** SeaLifeBase: species flagged Fresh, Brack or Saltwater. */
  aquatic: boolean | null;
}

export const collapse = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

export function asQuality(s: string | null | undefined): LifespanQuality | null {
  const v = (s ?? "").trim().toLowerCase();
  return v === "high" || v === "acceptable" || v === "questionable" || v === "low" ? v : null;
}
