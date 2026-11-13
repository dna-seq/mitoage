/**
 * Several RefSeq records as one FASTA text, fetched in the browser from NCBI E-utilities
 * (efetch answers cross-origin requests). The site hosts no sequences. Safe for islands.
 *
 * NCBI answers 200 and leaves out a record it does not have, without saying so. Every answer
 * is therefore checked against the accessions asked for, and the result names the missing ones.
 */
import { refseqFastaBatchUrl } from "./urls";

/** Accessions per request. NCBI asks for at most 200 ids in a URL; 100 mitochondrial genomes are about 1.7 MB. */
export const FASTA_BATCH = 100;
/** Pause between requests, ms: NCBI allows three a second without an API key. */
const PAUSE_MS = 400;
/** Waits, ms, before the second and third attempt of a request that got no answer, a 429 (load) or a 5xx. */
const RETRY_MS: readonly number[] = [1500, 4000];
/** Characters of an error body kept in the result. */
const DETAIL_MAX = 300;

/** One FASTA record: its accession.version (the first word of the header) and its text, header included. */
export interface FastaRecord {
  accession: string;
  text: string;
}

/**
 * Records of a FASTA text, in order. Lines are kept as they are, blank lines dropped, and each
 * record ends with a newline. Anything before the first header is not a record and is left out.
 */
export function fastaRecords(text: string): FastaRecord[] {
  const out: FastaRecord[] = [];
  let lines: string[] | null = null;
  const close = () => {
    if (!lines) return;
    const header = lines[0] ?? "";
    out.push({ accession: header.slice(1).trim().split(/\s+/)[0] ?? "", text: `${lines.join("\n")}\n` });
  };
  for (const raw of text.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.startsWith(">")) {
      close();
      lines = [line];
    } else if (lines && line.trim() !== "") lines.push(line);
  }
  close();
  return out;
}

/** Consecutive groups of at most `size` items; their concatenation is `items`. */
export function batches<T>(items: readonly T[], size: number): T[][] {
  const n = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

export type FastaFailure =
  /** The request never got an answer: offline, blocked, the connection dropped. */
  | "network"
  /** NCBI answered with an error status. */
  | "http"
  /** Stopped through the signal. */
  | "aborted";

export type FastaResult =
  /** Every accession asked for came back. */
  | { kind: "complete"; text: string; count: number }
  /** NCBI answered, but without some records: `text` holds the `count` that came back. */
  | { kind: "incomplete"; text: string; count: number; missing: string[] }
  /** No usable answer, so there is no text. `detail` is what the browser or NCBI said, as said. */
  | { kind: "failed"; reason: FastaFailure; status: number | null; detail: string };

export interface FetchFastaOptions {
  /** The fetch to use (tests pass their own). */
  fetch?: (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;
  batchSize?: number;
  pauseMs?: number;
  retryMs?: readonly number[];
  signal?: AbortSignal;
  /** Called after each request with the accessions asked for so far and their total. */
  onProgress?: (done: number, total: number) => void;
}

type Failed = Extract<FastaResult, { kind: "failed" }>;
const ABORTED: Failed = { kind: "failed", reason: "aborted", status: null, detail: "" };

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/** One request, asked again only where asking again can help: no answer, 429 and 5xx. Another 4xx is final. */
async function request(
  url: string,
  doFetch: NonNullable<FetchFastaOptions["fetch"]>,
  retryMs: readonly number[],
  signal: AbortSignal | undefined,
): Promise<{ text: string } | Failed> {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) return ABORTED;
    let failed: Failed;
    try {
      const res = await doFetch(url, signal ? { signal } : {});
      if (res.ok) return { text: await res.text() };
      const body = await res.text().catch(() => "");
      failed = { kind: "failed", reason: "http", status: res.status, detail: body.slice(0, DETAIL_MAX) };
      if (res.status !== 429 && res.status < 500) return failed;
    } catch (e) {
      if (signal?.aborted) return ABORTED;
      failed = { kind: "failed", reason: "network", status: null, detail: e instanceof Error ? e.message : String(e) };
    }
    const wait = retryMs[attempt];
    if (wait === undefined) return failed;
    await sleep(wait, signal);
  }
}

/**
 * The FASTA records of `accessions` (versioned RefSeq accessions), in the order given, each once.
 * A failed request fails the whole download: part of a selection is not a file to hand over.
 */
export async function fetchFasta(accessions: readonly string[], opts: FetchFastaOptions = {}): Promise<FastaResult> {
  const ids = [...new Set(accessions)];
  const doFetch = opts.fetch ?? ((url, init) => fetch(url, init));
  const pauseMs = opts.pauseMs ?? PAUSE_MS;
  const found = new Map<string, string>();
  let done = 0;
  for (const group of batches(ids, opts.batchSize ?? FASTA_BATCH)) {
    if (done > 0) await sleep(pauseMs, opts.signal);
    const answer = await request(refseqFastaBatchUrl(group), doFetch, opts.retryMs ?? RETRY_MS, opts.signal);
    if ("kind" in answer) return answer;
    for (const rec of fastaRecords(answer.text)) if (!found.has(rec.accession)) found.set(rec.accession, rec.text);
    done += group.length;
    opts.onProgress?.(done, ids.length);
  }
  // Only what was asked for is written and counted, whatever else an answer held.
  const missing = ids.filter((id) => !found.has(id));
  const count = ids.length - missing.length;
  const text = ids.map((id) => found.get(id) ?? "").join("");
  return missing.length ? { kind: "incomplete", text, count, missing } : { kind: "complete", text, count };
}

/** The text to save, or null when there is nothing to save: a failure, or no record at all. */
export const fastaToSave = (r: FastaResult): string | null => (r.kind !== "failed" && r.count > 0 ? r.text : null);

export interface FastaNote {
  tone: "ok" | "warn" | "error";
  text: string;
}

const sequences = (n: number): string => `${n.toLocaleString("en-US")} ${n === 1 ? "sequence" : "sequences"}`;
/** Accessions named in a note before the rest is given as a count. */
const NAMED = 8;

/** What to tell the person about a result, in one line. Says "nothing was saved" exactly when fastaToSave is null. */
export function describeFasta(r: FastaResult, filename: string): FastaNote {
  if (r.kind === "complete")
    return r.count > 0
      ? { tone: "ok", text: `Downloaded ${sequences(r.count)} from NCBI as ${filename}.` }
      : { tone: "warn", text: "No sequences were asked for; nothing was saved." };
  if (r.kind === "incomplete") {
    const total = r.count + r.missing.length;
    if (r.count === 0) return { tone: "error", text: `NCBI returned none of the ${sequences(total)}; nothing was saved.` };
    const rest = r.missing.length - NAMED;
    const names = r.missing.slice(0, NAMED).join(", ") + (rest > 0 ? ` and ${rest.toLocaleString("en-US")} more` : "");
    return {
      tone: "warn",
      text: `Downloaded ${r.count.toLocaleString("en-US")} of ${sequences(total)} as ${filename}. NCBI returned no record for ${r.missing.length.toLocaleString("en-US")}: ${names}.`,
    };
  }
  if (r.reason === "aborted") return { tone: "warn", text: "The download was stopped; nothing was saved." };
  if (r.reason === "network")
    return {
      tone: "error",
      text: `Could not reach NCBI${r.detail ? ` (${r.detail})` : ""}; nothing was saved. Check the connection and try again.`,
    };
  if (r.status === 429)
    return { tone: "error", text: "NCBI is limiting requests from this network (HTTP 429); nothing was saved. Try again in a minute." };
  if (r.status !== null && r.status >= 500)
    return { tone: "error", text: `NCBI could not answer (HTTP ${r.status}); nothing was saved. Try again later.` };
  return { tone: "error", text: `NCBI refused the request (HTTP ${r.status ?? "unknown"}); nothing was saved.` };
}
