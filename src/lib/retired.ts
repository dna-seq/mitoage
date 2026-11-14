/**
 * Retired records of the build: species the site still lists (their pages, the tables, the
 * side-by-side view) although they no longer qualify, most because RefSeq removed their record.
 * NCBI still serves a removed record, so a FASTA download would hand it out without a word; the
 * download names these instead (./fastaDownload). The list is served as /species/retired.json and
 * read only when a download runs. Safe for islands.
 */
import type { Species } from "~/data/schema";
import { href } from "./url";

export interface RetiredRecord {
  /** Versioned RefSeq accession, as the tables carry it. */
  accession: string;
  /** Scientific name, as the species page gives it. */
  name: string;
  slug: string;
}

export interface RetiredFile {
  retired: RetiredRecord[];
}

export const RETIRED_URL = href("/species/retired.json");

/** The retired species of `species`, as the species page decides it (record status "retired"), by accession. */
export function retiredRecords(species: readonly Species[]): RetiredRecord[] {
  return species
    .filter((s) => s.provenance?.recordStatus === "retired")
    .map((s) => ({ accession: s.refseq, name: s.scientificName, slug: s.slug }))
    .sort((a, b) => (a.accession < b.accession ? -1 : a.accession > b.accession ? 1 : 0));
}

/** The records of a /species/retired.json body by accession; throws on anything else. */
export function readRetired(body: unknown): ReadonlyMap<string, RetiredRecord> {
  const list = (body as Partial<RetiredFile> | null)?.retired;
  if (!Array.isArray(list)) throw new Error("the list of retired records is malformed");
  const out = new Map<string, RetiredRecord>();
  for (const r of list as unknown[]) {
    const x = r as Partial<RetiredRecord> | null;
    if (typeof x?.accession !== "string" || !x.accession || typeof x.name !== "string" || typeof x.slug !== "string")
      throw new Error("the list of retired records is malformed");
    out.set(x.accession, { accession: x.accession, name: x.name, slug: x.slug });
  }
  return out;
}

let cached: Promise<ReadonlyMap<string, RetiredRecord>> | undefined;

/** The build's retired records, fetched once per page. Rejects when the list cannot be read; the next call asks again. */
export function loadRetired(): Promise<ReadonlyMap<string, RetiredRecord>> {
  if (!cached) {
    const p = fetch(RETIRED_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(readRetired);
    cached = p;
    p.catch(() => {
      if (cached === p) cached = undefined;
    });
  }
  return cached;
}

/** Retired records named in a note before the rest is given as a count. */
const NAMED = 8;

/**
 * What to say about the retired records among the `saved` records of a file, in the file's order,
 * or undefined when there is none.
 */
export function retiredSentence(retired: readonly RetiredRecord[], saved: number): string | undefined {
  if (!retired.length) return undefined;
  const rest = retired.length - NAMED;
  const names = retired.slice(0, NAMED).map((r) => r.name).join(", ") + (rest > 0 ? ` and ${rest.toLocaleString("en-US")} more` : "");
  const lead =
    retired.length === 1
      ? saved === 1
        ? "It is a retired record"
        : "One of them is a retired record"
      : `${retired.length.toLocaleString("en-US")} of them are retired records`;
  return `${lead}, left out of this build's correlations and alignments (each species page says why): ${names}.`;
}
