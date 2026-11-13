import { describe, expect, test } from "bun:test";
import { getAllSpecies } from "~/data";
import { batches, describeFasta, FASTA_BATCH, fastaRecords, fastaToSave, fetchFasta, type FastaResult } from "./fasta";
import { refseqFastaBatchUrl, refseqFastaUrl } from "./urls";

/**
 * testdata/refseq.fasta is NCBI's answer, byte for byte, to one efetch request for three records
 * of the data (NC_012920.1, NC_015112.1, NC_005089.1), taken 2026-11-13. Expected values are read
 * from it here by other means than the code under test: headers by line, records by blank line.
 */
const FIXTURE = await Bun.file(new URL("./testdata/refseq.fasta", import.meta.url)).text();
const HEADERS = FIXTURE.split("\n").filter((l) => l.startsWith(">"));
const IDS = HEADERS.map((h) => h.slice(1).split(" ")[0] ?? "");
const RECORDS = new Map(
  FIXTURE.split("\n\n")
    .filter((block) => block !== "")
    .map((block) => [block.slice(1).split(" ")[0] ?? "", `${block}\n`]),
);
const ALL = getAllSpecies().map((s) => s.refseq);
/** Accessions of the data that the fixture, and so the stand-in for NCBI below, does not have. */
const ABSENT = ALL.filter((a) => !RECORDS.has(a));

/** NCBI's answer to a request for one accession it does not have, as received 2026-11-13 (HTTP 400). */
const REFUSAL =
  "+Error%3A+CEFetchPApplication%3A%3Aproxy_stream()%3A+Error%3A+F+a+i+l+e+d++t+o++r+e+t+r+i+e+v+e++s+e+q+u+e+n+c+e+%3A++N+C+_+9+9+9+9+9+9+.+1+%0A%0A";

/**
 * Stands in for efetch with the fixture's records, answering as NCBI was seen to: 200 with the
 * records it has, a blank line after each, and nothing about the others; 400 when it has none.
 * `status` overrides the answer of the n-th request (0-based); `extra` is a record sent unasked.
 */
function ncbi(opts: { reverse?: boolean; status?: (n: number) => number | undefined; extra?: string } = {}) {
  const asked: string[][] = [];
  const fetch = async (url: string): Promise<Response> => {
    const u = new URL(url);
    const ids = (u.searchParams.get("id") ?? "").split(",");
    const forced = opts.status?.(asked.length);
    asked.push(ids);
    if (forced !== undefined) return new Response("", { status: forced });
    const have = ids.filter((id) => RECORDS.has(id));
    if (!have.length) return new Response(REFUSAL, { status: 400 });
    if (opts.extra !== undefined) have.push(opts.extra);
    const order = opts.reverse ? [...have].reverse() : have;
    return new Response(order.map((id) => `${RECORDS.get(id)}\n`).join(""), { status: 200 });
  };
  return { fetch, asked };
}
const FAST = { pauseMs: 0, retryMs: [0, 0] };
const textOf = (ids: readonly string[]) => ids.map((id) => RECORDS.get(id) ?? "").join("");

describe("fixture", () => {
  test("holds three records, each of a species in the data", () => {
    expect(IDS.length).toBe(3);
    expect(new Set(IDS).size).toBe(3);
    expect([...RECORDS.keys()]).toEqual(IDS);
    for (const id of IDS) expect(ALL).toContain(id);
    expect(ABSENT.length).toBe(ALL.length - 3);
  });
});

describe("fastaRecords", () => {
  test("splits NCBI's answer into its records and loses nothing but the blank lines", () => {
    const recs = fastaRecords(FIXTURE);
    expect(recs.map((r) => r.accession)).toEqual(IDS);
    expect(recs.map((r) => r.text)).toEqual(IDS.map((id) => RECORDS.get(id) ?? ""));
    expect(recs.map((r) => r.text).join("")).toBe(FIXTURE.replace(/\n\n/g, "\n"));
    recs.forEach((r, i) => expect(r.text.split("\n")[0]).toBe(HEADERS[i] ?? ""));
  });

  test("each record has as many bases as the data gives the species' genome", () => {
    const size = new Map(getAllSpecies().map((s) => [s.refseq, s.mtdnaSizeBp]));
    for (const r of fastaRecords(FIXTURE)) {
      const bases = r.text.split("\n").slice(1).join("").length;
      expect(bases).toBe(size.get(r.accession) ?? -1);
    }
  });

  test("empty, headerless, CRLF and header-only input", () => {
    expect(fastaRecords("")).toEqual([]);
    const body = (RECORDS.get(IDS[0] ?? "") ?? "").split("\n").slice(1).join("\n");
    expect(body.length).toBeGreaterThan(0);
    expect(fastaRecords(body)).toEqual([]);
    expect(fastaRecords(`${body}${FIXTURE}`)).toEqual(fastaRecords(FIXTURE));
    expect(fastaRecords(FIXTURE.replace(/\n/g, "\r\n"))).toEqual(fastaRecords(FIXTURE));
    const header = HEADERS[0] ?? "";
    expect(fastaRecords(header)).toEqual([{ accession: IDS[0] ?? "", text: `${header}\n` }]);
  });
});

describe("batches", () => {
  test("cover the items in order, full but for the last", () => {
    for (const size of [1, 2, 7, FASTA_BATCH, ALL.length - 1, ALL.length, ALL.length + 1]) {
      const groups = batches(ALL, size);
      expect(groups.flat()).toEqual(ALL);
      expect(groups.length).toBe(Math.ceil(ALL.length / size));
      groups.slice(0, -1).forEach((g) => expect(g.length).toBe(size));
      expect(groups.at(-1)?.length).toBe(ALL.length - size * (groups.length - 1));
    }
  });

  test("no items give no batch; a size below one is one", () => {
    expect(batches([], FASTA_BATCH)).toEqual([]);
    for (const size of [0, -3, Number.NaN]) expect(batches(IDS, size)).toEqual(IDS.map((id) => [id]));
  });
});

describe("refseqFastaBatchUrl", () => {
  test("carries the accessions, in order, to nuccore as FASTA text", () => {
    const u = new URL(refseqFastaBatchUrl(ALL.slice(0, FASTA_BATCH)));
    expect(u.searchParams.get("id")?.split(",")).toEqual(ALL.slice(0, FASTA_BATCH));
    expect([u.searchParams.get("db"), u.searchParams.get("rettype"), u.searchParams.get("retmode")]).toEqual(["nuccore", "fasta", "text"]);
    expect(refseqFastaBatchUrl([IDS[0] ?? ""])).toBe(refseqFastaUrl(IDS[0] ?? ""));
  });
});

describe("fetchFasta", () => {
  test("every record, in the order asked, over several requests", async () => {
    const order = [IDS[2] ?? "", IDS[0] ?? "", IDS[1] ?? ""];
    const server = ncbi();
    const progress: [number, number][] = [];
    const r = await fetchFasta(order, { ...FAST, fetch: server.fetch, batchSize: 2, onProgress: (d, t) => progress.push([d, t]) });
    expect(r).toEqual({ kind: "complete", text: textOf(order), count: 3 });
    expect(server.asked).toEqual([[order[0] ?? "", order[1] ?? ""], [order[2] ?? ""]]);
    expect(progress).toEqual([[2, 3], [3, 3]]);
    expect(fastaRecords((r as { text: string }).text).map((x) => x.accession)).toEqual(order);
  });

  test("the order asked holds when NCBI answers in another", async () => {
    const r = await fetchFasta(IDS, { ...FAST, fetch: ncbi({ reverse: true }).fetch });
    expect(r).toEqual({ kind: "complete", text: textOf(IDS), count: 3 });
  });

  test("an accession given twice is asked for and written once", async () => {
    const server = ncbi();
    const r = await fetchFasta([...IDS, ...IDS], { ...FAST, fetch: server.fetch });
    expect(server.asked).toEqual([IDS]);
    expect(r).toEqual({ kind: "complete", text: textOf(IDS), count: 3 });
  });

  test("a record NCBI leaves out of a 200 answer is named, and the rest is kept", async () => {
    const gone = ABSENT[0] ?? "";
    const asked = [IDS[0] ?? "", gone, IDS[1] ?? ""];
    const r = await fetchFasta(asked, { ...FAST, fetch: ncbi().fetch });
    expect(r).toEqual({ kind: "incomplete", text: textOf([IDS[0] ?? "", IDS[1] ?? ""]), count: 2, missing: [gone] });
  });

  test("a record nobody asked for is neither written nor counted", async () => {
    const asked = [IDS[0] ?? "", IDS[1] ?? ""];
    const r = await fetchFasta(asked, { ...FAST, fetch: ncbi({ extra: IDS[2] ?? "" }).fetch });
    expect(r).toEqual({ kind: "complete", text: textOf(asked), count: asked.length });
  });

  test("a refusal is a failure, carried as NCBI said it, and is not asked again", async () => {
    const server = ncbi();
    const r = await fetchFasta(ABSENT.slice(0, 2), { ...FAST, fetch: server.fetch });
    expect(r).toEqual({ kind: "failed", reason: "http", status: 400, detail: REFUSAL });
    expect(server.asked.length).toBe(1);
  });

  test("429 and 5xx are asked again as often as there are waits, then fail", async () => {
    for (const status of [429, 503]) {
      const server = ncbi({ status: () => status });
      const r = await fetchFasta(IDS, { ...FAST, fetch: server.fetch });
      expect(r).toEqual({ kind: "failed", reason: "http", status, detail: "" });
      expect(server.asked.length).toBe(1 + FAST.retryMs.length);
    }
  });

  test("a request turned away once succeeds on the next attempt", async () => {
    const server = ncbi({ status: (n) => (n === 0 ? 429 : undefined) });
    const r = await fetchFasta(IDS, { ...FAST, fetch: server.fetch });
    expect(r).toEqual({ kind: "complete", text: textOf(IDS), count: 3 });
    expect(server.asked).toEqual([IDS, IDS]);
  });

  test("a later request that fails fails the whole download: no partial text", async () => {
    const server = ncbi({ status: (n) => (n >= 1 ? 500 : undefined) });
    const r = await fetchFasta(IDS, { ...FAST, fetch: server.fetch, batchSize: 1 });
    expect(r).toEqual({ kind: "failed", reason: "http", status: 500, detail: "" });
    expect(fastaToSave(r)).toBeNull();
  });

  test("no answer is asked again as often as there are waits, then fails as the browser said it", async () => {
    let calls = 0;
    const r = await fetchFasta(IDS, {
      ...FAST,
      fetch: () => {
        calls++;
        return Promise.reject(new TypeError("Failed to fetch"));
      },
    });
    expect(r).toEqual({ kind: "failed", reason: "network", status: null, detail: "Failed to fetch" });
    expect(calls).toBe(1 + FAST.retryMs.length);
  });

  test("a connection that drops once is asked again and the download completes", async () => {
    const server = ncbi();
    let calls = 0;
    const r = await fetchFasta(IDS, {
      ...FAST,
      fetch: (url) => (calls++ === 0 ? Promise.reject(new TypeError("Failed to fetch")) : server.fetch(url)),
    });
    expect(r).toEqual({ kind: "complete", text: textOf(IDS), count: 3 });
    expect(calls).toBe(2);
  });

  test("a stop before the start asks nothing; a stop on the way ends there", async () => {
    const before = new AbortController();
    before.abort();
    const idle = ncbi();
    expect(await fetchFasta(IDS, { ...FAST, fetch: idle.fetch, signal: before.signal })).toEqual({
      kind: "failed",
      reason: "aborted",
      status: null,
      detail: "",
    });
    expect(idle.asked).toEqual([]);

    const during = new AbortController();
    const server = ncbi();
    const r = await fetchFasta(IDS, { ...FAST, fetch: server.fetch, batchSize: 1, signal: during.signal, onProgress: () => during.abort() });
    expect(r.kind === "failed" && r.reason).toBe("aborted");
    expect(server.asked).toEqual([[IDS[0] ?? ""]]);
  });

  test("nothing asked for is complete and empty, without a request", async () => {
    const server = ncbi();
    expect(await fetchFasta([], { ...FAST, fetch: server.fetch })).toEqual({ kind: "complete", text: "", count: 0 });
    expect(server.asked).toEqual([]);
  });
});

describe("describeFasta", () => {
  const NAME = "genomes.fasta";

  test("says nothing was saved exactly when there is nothing to save", async () => {
    const results: FastaResult[] = [
      await fetchFasta(IDS, { ...FAST, fetch: ncbi().fetch }),
      await fetchFasta([], { ...FAST, fetch: ncbi().fetch }),
      await fetchFasta([...IDS, ABSENT[0] ?? ""], { ...FAST, fetch: ncbi().fetch }),
      await fetchFasta(ABSENT.slice(0, 1), { ...FAST, fetch: ncbi().fetch }),
      await fetchFasta(IDS, { ...FAST, fetch: ncbi({ status: () => 429 }).fetch }),
      await fetchFasta(IDS, { ...FAST, fetch: ncbi({ status: () => 502 }).fetch }),
      await fetchFasta(IDS, { ...FAST, fetch: () => Promise.reject(new TypeError("Failed to fetch")) }),
      { kind: "incomplete", text: "", count: 0, missing: [...IDS] },
      { kind: "failed", reason: "aborted", status: null, detail: "" },
    ];
    expect(results.map((r) => r.kind)).toEqual([
      "complete", "complete", "incomplete", "failed", "failed", "failed", "failed", "incomplete", "failed",
    ]);
    for (const r of results) {
      const note = describeFasta(r, NAME);
      expect(note.text.includes("nothing was saved")).toBe(fastaToSave(r) === null);
      expect(note.tone === "ok").toBe(r.kind === "complete" && r.count > 0);
      if (r.kind === "failed" && r.status !== null) expect(note.text).toContain(`HTTP ${r.status}`);
    }
  });

  test("a complete download gives its count and file; an incomplete one names what is missing", async () => {
    const whole = describeFasta(await fetchFasta(IDS, { ...FAST, fetch: ncbi().fetch }), NAME);
    expect(whole.text).toContain(`${IDS.length} sequences`);
    expect(whole.text).toContain(NAME);

    const few = [ABSENT[0] ?? "", ABSENT[1] ?? ""];
    const part = describeFasta(await fetchFasta([...IDS, ...few], { ...FAST, fetch: ncbi().fetch }), NAME);
    expect(part.tone).toBe("warn");
    expect(part.text).toContain(`${IDS.length} of ${IDS.length + few.length} sequences`);
    for (const id of few) expect(part.text).toContain(id);
  });

  test("a long list of missing records is cut, and says by how many", async () => {
    const r = await fetchFasta(ALL, { ...FAST, fetch: ncbi().fetch, batchSize: ALL.length });
    expect(r.kind).toBe("incomplete");
    if (r.kind !== "incomplete") return;
    expect(r.missing).toEqual(ABSENT);
    const note = describeFasta(r, NAME);
    const named = ABSENT.filter((id) => note.text.includes(id));
    expect(named).toEqual(ABSENT.slice(0, named.length));
    expect(named.length).toBeGreaterThan(0);
    // Counts are written with a thousands separator (en-US), as describeFasta does.
    expect(note.text).toContain(`and ${(ABSENT.length - named.length).toLocaleString("en-US")} more`);
    expect(note.text).toContain(`no record for ${ABSENT.length.toLocaleString("en-US")}`);
  });
});
