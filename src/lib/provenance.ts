/**
 * Words and links for where a species' record comes from: the source of its maximum lifespan, the
 * licence of that value, and the status of the row against build 1. Pure, safe for islands.
 */
import type { LifespanInfo, LifespanRecordType, LifespanSource, RecordStatus, Species } from "~/data/schema";
import { anageUrl } from "./urls";

const SOURCE_NAMES: Record<LifespanSource, string> = {
  AnAge: "AnAge",
  FishBase: "FishBase",
  SeaLifeBase: "SeaLifeBase",
  EURING: "EURING",
  USGS_BBL: "USGS Bird Banding Laboratory",
  MitoAge_build1: "MitoAge build 1",
};

export const lifespanSourceName = (source: LifespanSource): string => SOURCE_NAMES[source];

/** "Genus-species" as FishBase and SeaLifeBase spell a species in their summary URLs. */
const summarySlug = (scientificName: string): string =>
  scientificName.trim().split(/\s+/).slice(0, 2).map(encodeURIComponent).join("-");

/**
 * The page of the source that holds the value, or null where the source has none to link
 * (the 2015 build's own value). A species without lifespan metadata is a build 1 row, read from AnAge.
 */
export function lifespanSourceLink(s: Pick<Species, "scientificName" | "lifespan">): { href: string; label: string } | null {
  const source: LifespanSource = s.lifespan?.source ?? "AnAge";
  switch (source) {
    case "AnAge":
      return { href: anageUrl(s.scientificName), label: "AnAge record" };
    case "FishBase":
      return { href: `https://www.fishbase.se/summary/${summarySlug(s.scientificName)}.html`, label: "FishBase record" };
    case "SeaLifeBase":
      return { href: `https://www.sealifebase.se/summary/${summarySlug(s.scientificName)}.html`, label: "SeaLifeBase record" };
    case "USGS_BBL":
      return { href: "https://www.pwrc.usgs.gov/BBL/longevity/Longevity_main.cfm", label: "USGS longevity records" };
    case "EURING":
      return { href: "https://euring.org/data-and-codes/longevity-list", label: "EURING longevity list" };
    case "MitoAge_build1":
      return null;
  }
}

const RECORD_TYPES: Record<LifespanRecordType, string> = {
  captive: "an animal in captivity",
  wild: "an animal in the wild",
  observed: "an observed animal, origin not stated",
  estimated: "an estimate, not an observed animal",
  compiled: "the 2015 compilation",
};

export const recordTypeLabel = (t: LifespanRecordType): string => RECORD_TYPES[t];

/** The licence's name: the text before its first parenthesis or semicolon. */
export const licenceName = (license: string): string => (/^[^(;]+/.exec(license)?.[0] ?? license).trim();

/** True for a value that may not be used commercially (FishBase and SeaLifeBase, CC BY-NC). */
export const isNonCommercial = (l: Pick<LifespanInfo, "license"> | undefined): boolean => /\bBY-NC\b/i.test(l?.license ?? "");

const STATUS: Record<RecordStatus, string> = {
  original: "Unchanged since build 1",
  updated: "Updated in build 2",
  new: "New in build 2",
  renamed: "Renamed in build 2",
  retired: "Retired",
};

export const recordStatusLabel = (status: RecordStatus): string => STATUS[status];

const FLAGS: Record<string, (detail: string) => string> = {
  cited_record_resolves_to_other_species: () => "The RefSeq record cited by build 1 now belongs to another species at NCBI.",
  possible_duplicate_species: (d) => `May be the same species as ${d || "another entry"}.`,
  source_match_in_review: () => "A match to a lifespan source is under review and was not used.",
  lifespan_from_build1_only: () => "The lifespan is the 2015 build's value; no curated source lists one now.",
  ncbi_taxid_shared_in_build1: () => "Build 1 held another entry under the same NCBI taxon.",
  anage_name_differs: (d) => `AnAge lists this species as ${d || "another name"}.`,
  rows_not_in_current_record: () => "Some regions come from the record build 1 cited: the current record does not annotate them.",
  lifespan_provisional_euring_not_retrieved: () => "Provisional: the EURING list could not be retrieved, so the USGS record is used.",
};

/** A review flag ("kind" or "kind:detail") as a sentence; an unknown kind is shown as written, never dropped. */
export function reviewFlagText(flag: string): string {
  const i = flag.indexOf(":");
  const kind = i < 0 ? flag : flag.slice(0, i);
  const detail = i < 0 ? "" : flag.slice(i + 1).trim();
  return FLAGS[kind]?.(detail) ?? flag.replace(/_/g, " ");
}
