/**
 * NCBI RefSeq mitochondrion release (pinned: release 237). Streams the gzipped GBFF twice:
 * once for the record headers (all records), once to keep the full text of selected records.
 */
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { md5File } from "../lib/parquet";
import { REFSEQ_RELEASE, requirePinned } from "./pinned";

export interface RefSeqHeader {
  version: string;
  accession: string;
  length: number;
  topology: string;
  /** LOCUS date as ISO yyyy-mm-dd (the record's last update). */
  updateDate: string;
  definition: string;
  organism: string;
  /** "Eukaryota; Metazoa; ..." */
  lineage: string;
  taxid: number | null;
  /** REVIEWED, PROVISIONAL, VALIDATED, ... from the COMMENT, or null. */
  refseqStatus: string | null;
}

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

export function locusDate(s: string): string {
  const m = /^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(s);
  if (!m || !MONTHS[m[2]!]) throw new Error(`bad LOCUS date ${s}`);
  return `${m[3]}-${MONTHS[m[2]!]}-${m[1]}`;
}

export function parseHeader(rec: string): RefSeqHeader {
  const end = rec.indexOf("\nFEATURES");
  const head = end >= 0 ? rec.slice(0, end) : rec;
  const lines = head.split("\n");
  const locus = lines[0]!.trim().split(/\s+/);
  if (locus[0] !== "LOCUS") throw new Error(`record does not start with LOCUS: ${lines[0]}`);
  const len = /(\d+)\s+bp/.exec(lines[0]!);
  let definition = "";
  let version = "";
  let organism = "";
  let lineage = "";
  let refseqStatus: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.startsWith("DEFINITION")) {
      definition = l.slice(12).trim();
      while (lines[i + 1]?.startsWith("            ")) definition += " " + lines[++i]!.trim();
    } else if (l.startsWith("VERSION")) {
      version = l.slice(12).trim().split(/\s+/)[0] ?? "";
    } else if (l.startsWith("  ORGANISM")) {
      organism = l.slice(12).trim();
      const parts: string[] = [];
      while (lines[i + 1]?.startsWith("            ")) parts.push(lines[++i]!.trim());
      lineage = parts.join(" ").replace(/\.$/, "");
    } else if (l.startsWith("COMMENT") && refseqStatus === null) {
      refseqStatus = /(REVIEWED|PROVISIONAL|VALIDATED|INFERRED|PREDICTED|MODEL|WGS) REFSEQ/.exec(l)?.[1] ?? null;
    }
  }
  const tx = /\/db_xref="taxon:(\d+)"/.exec(rec);
  return {
    version,
    accession: version.split(".")[0]!,
    length: len ? Number(len[1]) : 0,
    topology: /\bcircular\b/.test(lines[0]!) ? "circular" : "linear",
    updateDate: locusDate(locus[locus.length - 1]!),
    definition,
    organism,
    lineage,
    taxid: tx ? Number(tx[1]) : null,
    refseqStatus,
  };
}

/** Completeness class of a record (the build 2 rule: NC_ complete single-molecule mitogenomes). */
export type Completeness =
  | "complete_genome"
  | "complete_sequence"
  | "complete_assembly_organelle"
  | "excluded_non_NC_contig"
  | "excluded_partial"
  | "excluded_multipartite"
  | "excluded_assembly_linear"
  | "excluded_unclassified";

const MULTI = /chromosome|minicircle|segment|\bpart\b|fragment|minichromosome|molecule/;

export function completeness(h: RefSeqHeader): Completeness {
  const d = h.definition.toLowerCase();
  if (!h.accession.startsWith("NC_")) return "excluded_non_NC_contig";
  if (d.includes("partial") || d.includes("nearly complete")) return "excluded_partial";
  if (MULTI.test(d)) return "excluded_multipartite";
  if (d.includes("complete genome") || d.includes("complete mitochondrial genome")) return "complete_genome";
  if (d.includes("complete sequence")) return "complete_sequence";
  if (d.includes("genome assembly, organelle: mitochondrion")) {
    return h.topology === "circular" ? "complete_assembly_organelle" : "excluded_assembly_linear";
  }
  return "excluded_unclassified";
}

export const isComplete = (c: Completeness) => c.startsWith("complete");

async function scan(path: string, onRecord: (rec: string) => void): Promise<void> {
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of createReadStream(path).pipe(createGunzip({ chunkSize: 1 << 20 }))) {
    buf += dec.decode(chunk as Uint8Array, { stream: true });
    let start = 0;
    let i: number;
    while ((i = buf.indexOf("\n//\n", start)) >= 0) {
      onRecord(buf.slice(start, i) + "\n//\n");
      start = i + 4;
    }
    buf = buf.slice(start);
  }
  buf += dec.decode();
  if (buf.trim()) throw new Error(`RefSeq release ends with an unterminated record (${buf.length} chars)`);
}

export interface RefSeqRelease {
  release: string;
  md5: string;
  headers: RefSeqHeader[];
  byVersion: Map<string, RefSeqHeader>;
  byAccession: Map<string, RefSeqHeader>;
  /** Full GenBank text of the given versions (second pass over the file). */
  records(versions: Iterable<string>): Promise<Map<string, string>>;
}

export async function loadRefSeqRelease(): Promise<RefSeqRelease> {
  const path = requirePinned(REFSEQ_RELEASE);
  const md5 = await md5File(path);
  if (md5 !== REFSEQ_RELEASE.md5) {
    throw new Error(`RefSeq release file md5 ${md5} != pinned ${REFSEQ_RELEASE.md5} (${path})`);
  }
  const headers: RefSeqHeader[] = [];
  await scan(path, (rec) => headers.push(parseHeader(rec)));
  const byVersion = new Map(headers.map((h) => [h.version, h]));
  const byAccession = new Map(headers.map((h) => [h.accession, h]));
  if (byVersion.size !== headers.length) throw new Error("RefSeq release: duplicate accession.version");
  return {
    release: "237",
    md5,
    headers,
    byVersion,
    byAccession,
    async records(versions) {
      const want = new Set(versions);
      const out = new Map<string, string>();
      await scan(path, (rec) => {
        const v = /^VERSION\s+(\S+)/m.exec(rec)?.[1];
        if (v && want.has(v)) out.set(v, rec);
      });
      const missing = [...want].filter((v) => !out.has(v));
      if (missing.length) throw new Error(`RefSeq release: records not found: ${missing.join(", ")}`);
      return out;
    },
  };
}
