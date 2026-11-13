import { describe, expect, test } from "bun:test";
import { getAllSpecies } from "~/data";
import { describeFasta, fetchFasta } from "./fasta";
import { type DownloadNote, downloadFasta } from "./fastaDownload";

/**
 * testdata/refseq.fasta is NCBI's answer, byte for byte, to one efetch request for three records
 * of the data (see fasta.test.ts). Its records are read here by blank line, not by the code
 * under test.
 */
const FIXTURE = await Bun.file(new URL("./testdata/refseq.fasta", import.meta.url)).text();
const RECORDS = new Map(
  FIXTURE.split("\n\n")
    .filter((block) => block !== "")
    .map((block) => [block.slice(1).split(" ")[0] ?? "", `${block}\n`]),
);
const IDS = [...RECORDS.keys()];
const [A, B, C] = IDS as [string, string, string];
/** Accessions of the data that the fixture, and so the stand-in for NCBI below, does not have. */
const ABSENT = getAllSpecies()
  .map((s) => s.refseq)
  .filter((a) => !RECORDS.has(a));
const GONE = ABSENT[0] ?? "";
const NAME = "chosen.fasta";
const FAST = { pauseMs: 0, retryMs: [0, 0] };

/**
 * Stands in for efetch with the fixture's records, answering as NCBI was seen to: 200 with the
 * records it has and nothing about the others, 400 when it has none. It answers in the reverse
 * of the order asked, so an order kept in the file is the caller's, not the answer's.
 */
const ncbi =
  (status?: number) =>
  async (url: string): Promise<Response> => {
    if (status !== undefined) return new Response("", { status });
    const ids = (new URL(url).searchParams.get("id") ?? "").split(",");
    const have = ids.filter((id) => RECORDS.has(id)).reverse();
    if (!have.length) return new Response("no such record", { status: 400 });
    return new Response(have.map((id) => `${RECORDS.get(id)}\n`).join(""), { status: 200 });
  };

/** Runs one download against the stand-in and keeps what was saved and what was said meanwhile. */
async function run(ids: readonly string[], opts: { status?: number; leftOut?: string; batchSize?: number; signal?: AbortSignal } = {}) {
  const saved: [name: string, text: string][] = [];
  const notes: DownloadNote[] = [];
  const said = await downloadFasta(ids, NAME, {
    ...FAST,
    fetch: ncbi(opts.status),
    save: (name, text) => saved.push([name, text]),
    onNote: (note) => notes.push(note),
    ...(opts.leftOut !== undefined ? { leftOut: opts.leftOut } : {}),
    ...(opts.batchSize !== undefined ? { batchSize: opts.batchSize } : {}),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  return { saved, notes, said };
}
/** Accessions of a FASTA text, read from its header lines. */
const accessionsOf = (text: string) =>
  text
    .split("\n")
    .filter((l) => l.startsWith(">"))
    .map((l) => l.slice(1).split(" ")[0] ?? "");
/** What ./fasta says about the same request, to compare the download's last word with. */
const plain = async (ids: readonly string[], status?: number) =>
  describeFasta(await fetchFasta(ids, { ...FAST, fetch: ncbi(status) }), NAME);

describe("downloadFasta", () => {
  test("the fixture has three records and the data has others", () => {
    expect(IDS.length).toBe(3);
    expect(GONE).not.toBe("");
  });

  test("saves once, under the name given, exactly the records asked for and in the order asked", async () => {
    for (const ids of [[A, B, C], [C, B, A], [B, A], [C]]) {
      const { saved, said } = await run(ids);
      expect(saved.length).toBe(1);
      const [name, text] = saved[0] ?? ["", ""];
      expect(name).toBe(NAME);
      expect(accessionsOf(text)).toEqual(ids);
      expect(text).toBe(ids.map((id) => RECORDS.get(id) ?? "").join(""));
      expect(said).toEqual(await plain(ids));
      expect(said.tone).toBe("ok");
      expect(said.text).toContain(NAME);
    }
  });

  test("says what it is doing while the requests run, then what happened", async () => {
    const { notes, said } = await run([A, B, C], { batchSize: 1 });
    expect(notes.map((x) => x.tone)).toEqual(["info", "info", "info", "info"]);
    expect(notes[0]?.text).toBe("Fetching 3 sequences from NCBI…");
    expect(notes.slice(1).map((x) => x.text)).toEqual([1, 2, 3].map((k) => `Fetching sequences from NCBI: ${k} of 3…`));
    expect(said.tone).not.toBe("info");
    expect((await run([A])).notes[0]?.text).toBe("Fetching 1 sequence from NCBI…");
  });

  test("a record NCBI leaves out is named, and the rest is saved", async () => {
    const ids = [A, GONE, C];
    const { saved, said } = await run(ids);
    expect(saved.length).toBe(1);
    expect(accessionsOf(saved[0]?.[1] ?? "")).toEqual([A, C]);
    expect(said).toEqual(await plain(ids));
    expect(said.tone).toBe("warn");
    expect(said.text).toContain(GONE);
  });

  test("nothing is saved when NCBI gives no usable answer, and the note says so", async () => {
    const stopped = new AbortController();
    stopped.abort();
    const cases: [ids: string[], opts: { status?: number; signal?: AbortSignal }, tone: DownloadNote["tone"]][] = [
      [[A, B], { status: 500 }, "error"],
      [[A, B], { status: 429 }, "error"],
      [[GONE], {}, "error"],
      [[A, B], { signal: stopped.signal }, "warn"],
      [[], {}, "warn"],
    ];
    for (const [ids, opts, tone] of cases) {
      const { saved, said } = await run(ids, opts);
      expect(saved).toEqual([]);
      expect(said.tone).toBe(tone);
      expect(said.text).toContain("nothing was saved");
      if (!opts.signal) expect(said).toEqual(await plain(ids, opts.status));
    }
  });

  test("what was left out follows the result and turns a complete download into a warning", async () => {
    const leftOut = "2 rows have no accession and were left out.";
    const whole = await run([A, B], { leftOut });
    expect(whole.saved.length).toBe(1);
    expect(whole.said).toEqual({ tone: "warn", text: `${(await plain([A, B])).text} ${leftOut}` });
    const part = await run([A, GONE], { leftOut });
    expect(part.said).toEqual({ tone: "warn", text: `${(await plain([A, GONE])).text} ${leftOut}` });
    const none = await run([A, B], { leftOut, status: 500 });
    expect(none.saved).toEqual([]);
    expect(none.said).toEqual({ tone: "error", text: `${(await plain([A, B], 500)).text} ${leftOut}` });
    // No sentence, no change.
    expect((await run([A, B], { leftOut: "" })).said).toEqual(await plain([A, B]));
  });
});
