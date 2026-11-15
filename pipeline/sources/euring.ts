/**
 * EURING longevity list of 2023-09-01 (Fransson, Kolehmainen, Moss & Robinson 2023). Birds:
 * AnAge > EURING > USGS BBL.
 *
 * The list is a PDF exported from a spreadsheet. euring.org has redirected every page to a
 * maintenance notice since at least 2026-11-13, so the pinned file is the Internet Archive's
 * capture of 2026-10-11; its SHA-1 equals the digest of every capture from 2023-12-16 to that
 * date, and its md5 is pinned here. Each species is a bold row (common name, oldest record) and
 * an italic row (scientific name, second oldest record, when there is one). Every age is a
 * minimum: birds ringed as full-grown are given an age from the start of their year of ringing.
 */
import { pdfTextRuns, type PdfTextRun } from "../lib/pdf-text";
import { cachedDownload } from "../lib/cache";
import { EURING } from "./pinned";
import { type SourceObservation, collapse } from "./observation";

export interface EuringRecord {
  commonName: string;
  scientificName: string;
  /** 1 for the species' oldest record, 2 for the second. */
  rank: 1 | 2;
  country: string;
  scheme: string;
  ringNo: string;
  /** The age cell as printed, e.g. "37y 0m". */
  ageText: string;
  /** Years; null when the cell cannot be read at all. */
  valueYears: number | null;
  /** Set when only part of the age cell could be read. */
  ageNote: string | null;
  finding: string;
}

/**
 * "37y 0m" -> 37; "12 y 11m" -> 12.9167. A month field that is not a number ("11y im", as printed
 * for one quail) keeps the years alone, which is still a minimum age, and says so.
 */
export function parseEuringAge(s: string): { years: number | null; note: string | null } {
  const m = /^\s*(\d+)\s*y\s*(\S+)\s*$/.exec(s);
  if (!m) return { years: null, note: `age "${s.trim()}" not readable` };
  const mm = /^(\d+)m$/.exec(m[2]!);
  if (mm && Number(mm[1]) < 12) return { years: Number(m[1]) + Number(mm[1]) / 12, note: null };
  return { years: Number(m[1]), note: `months "${m[2]}" not readable; whole years used` };
}

/** Column of a data cell by its x position on the page (cells are centred, so bands, not points). */
function column(x: number): "country" | "scheme" | "ringNo" | "age" | "finding" {
  if (x < 240) return "country";
  if (x < 290) return "scheme";
  if (x < 340) return "ringNo";
  if (x < 390) return "age";
  return "finding";
}

/** The list's records from its text runs. Throws on any row it cannot place. */
export function parseEuringList(runs: PdfTextRun[]): EuringRecord[] {
  // Reading order: page, then top to bottom (a row's cells differ in y by a fraction of a point), then left to right.
  const sorted = [...runs].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const rows: PdfTextRun[][] = [];
  for (const r of sorted) {
    const last = rows[rows.length - 1];
    if (last && last[0]!.page === r.page && Math.abs(last[0]!.y - r.y) < 1) last.push(r);
    else rows.push([r]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  const isHeader = (row: PdfTextRun[]) => row[0]!.text.startsWith("Species / Scientific name");
  const header = rows.findIndex(isHeader);
  if (header < 0) throw new Error("EURING list: no table header (Species / Scientific name)");
  const out: EuringRecord[] = [];
  let open: { commonName: string; scientificName: string | null; pending: Omit<EuringRecord, "commonName" | "scientificName" | "rank"> } | null = null;
  const cells = (row: PdfTextRun[]) => {
    const c = { country: "", scheme: "", ringNo: "", ageText: "", finding: "" };
    for (const r of row.slice(1)) {
      const k = column(r.x);
      const key = k === "age" ? "ageText" : k;
      if (c[key]) throw new Error(`EURING list: two ${k} cells on page ${r.page} at y ${r.y.toFixed(1)}`);
      c[key] = collapse(r.text);
    }
    if (!c.ageText) throw new Error(`EURING list: row "${row[0]!.text}" on page ${row[0]!.page} has no age`);
    const { years, note } = parseEuringAge(c.ageText);
    return { ...c, valueYears: years, ageNote: note };
  };
  for (const row of rows.slice(header + 1)) {
    if (isHeader(row)) continue;
    const first = row[0]!;
    if (first.x > 30) throw new Error(`EURING list: row without a name on page ${first.page} at y ${first.y.toFixed(1)}`);
    const name = collapse(first.text);
    if (first.font.includes("Bold")) {
      if (open && open.scientificName === null) throw new Error(`EURING list: ${open.commonName} has no scientific name`);
      open = { commonName: name, scientificName: null, pending: cells(row) };
      out.push({ commonName: name, scientificName: "", rank: 1, ...open.pending });
    } else {
      // The second row of a species: its scientific name (italic; one, Ciconia ciconia, is set upright).
      if (!open || open.scientificName !== null) throw new Error(`EURING list: "${name}" on page ${first.page} follows no common name`);
      open.scientificName = name;
      out[out.length - 1]!.scientificName = name;
      if (row.length > 1) out.push({ commonName: open.commonName, scientificName: name, rank: 2, ...cells(row) });
    }
  }
  if (open && open.scientificName === null) throw new Error(`EURING list: ${open.commonName} has no scientific name`);
  return out;
}

export async function loadEuring(): Promise<SourceObservation[]> {
  const bytes = await cachedDownload(EURING.path, EURING.url);
  const md5 = new Bun.CryptoHasher("md5").update(bytes).digest("hex");
  if (md5 !== EURING.md5) throw new Error(`data/cache/${EURING.path} has md5 ${md5}, pinned ${EURING.version} is ${EURING.md5}`);
  return parseEuringList(pdfTextRuns(bytes)).map((r) => ({
    source: "EURING" as const,
    sourceVersion: EURING.version,
    sourceRecordId: `euring20230901:${r.scheme}:${r.ringNo}`,
    sourceName: r.scientificName,
    sourceCommonName: r.commonName,
    valueYears: r.valueYears,
    recordType: "wild" as const,
    quality: "acceptable" as const,
    sampleSizeText: `single individual (${r.rank === 1 ? "oldest" : "second oldest"} ringed in Europe; minimum age)`,
    sex: null,
    detail: `age ${r.ageText}${r.ageNote ? ` (${r.ageNote})` : ""}; ${r.country}, scheme ${r.scheme}, ring ${r.ringNo}; ${r.finding}`,
    reference: "Fransson, Kolehmainen, Moss & Robinson (2023) EURING list of longevity records for European birds",
    license: EURING.license,
    speccode: null,
    aquatic: null,
  }));
}
