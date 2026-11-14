import { describe, expect, test } from "bun:test";
import { getAllSpecies } from "~/data";
import { describeFasta, fetchFasta } from "./fasta";
import { type DownloadNote, downloadFasta } from "./fastaDownload";
import { type RetiredRecord, readRetired, retiredRecords } from "./retired";

/**
 * testdata/refseq.fasta is NCBI's answer, byte for byte, to one efetch request for three records
 * of the data (see fasta.test.ts); testdata/retired.fasta is its answer to one request for two
 * records RefSeq removed, of species the build retired (NC_010972.2, NC_014400.1), taken
 * 2026-11-14. Records are read here by blank line, not by the code under test.
 */
const blocks = (text: string) =>
  text
    .split("\n\n")
    .filter((block) => block !== "")
    .map((block) => [block.slice(1).split(" ")[0] ?? "", `${block}\n`] as [string, string]);
const LIVE = blocks(await Bun.file(new URL("./testdata/refseq.fasta", import.meta.url)).text());
const GONE_FROM_REFSEQ = blocks(await Bun.file(new URL("./testdata/retired.fasta", import.meta.url)).text());
const RECORDS = new Map([...LIVE, ...GONE_FROM_REFSEQ]);
const IDS = LIVE.map(([id]) => id);
const [A, B, C] = IDS as [string, string, string];
const [R1, R2] = GONE_FROM_REFSEQ.map(([id]) => id) as [string, string];
const SPECIES = getAllSpecies();
/** Accessions of the data that the fixtures, and so the stand-in for NCBI below, do not have. */
const ABSENT = SPECIES.map((s) => s.refseq).filter((a) => !RECORDS.has(a));
/** A live species whose record the stand-in does not have, and a retired one. */
const GONE = SPECIES.find((s) => !RECORDS.has(s.refseq) && s.provenance?.recordStatus !== "retired")?.refseq ?? "";
const GONE_RETIRED = SPECIES.find((s) => !RECORDS.has(s.refseq) && s.provenance?.recordStatus === "retired")?.refseq ?? "";
/** The scientific name the data gives an accession, read from the species records. */
const nameOf = (acc: string) => SPECIES.find((s) => s.refseq === acc)?.scientificName ?? "";
const NAME = "chosen.fasta";
const FAST = { pauseMs: 0, retryMs: [0, 0] };
/** The build's retired records, as /species/retired.json carries them (a JSON round trip). */
const RETIRED = async () => readRetired(JSON.parse(JSON.stringify({ retired: retiredRecords(SPECIES) })));

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
async function run(
  ids: readonly string[],
  opts: {
    status?: number;
    leftOut?: string;
    batchSize?: number;
    signal?: AbortSignal;
    retired?: () => Promise<ReadonlyMap<string, RetiredRecord>>;
  } = {},
) {
  const saved: [name: string, text: string][] = [];
  const notes: DownloadNote[] = [];
  const said = await downloadFasta(ids, NAME, {
    ...FAST,
    fetch: ncbi(opts.status),
    save: (name, text) => saved.push([name, text]),
    onNote: (note) => notes.push(note),
    retired: opts.retired ?? RETIRED,
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
  test("the fixtures: three live records, two retired ones, and the data has others of both", () => {
    expect(IDS.length).toBe(3);
    expect(GONE_FROM_REFSEQ.length).toBe(2);
    const status = (acc: string) => SPECIES.find((s) => s.refseq === acc)?.provenance?.recordStatus;
    for (const id of IDS) expect(status(id)).not.toBe("retired");
    for (const id of [R1, R2]) expect(status(id)).toBe("retired");
    expect(GONE).not.toBe("");
    expect(GONE_RETIRED).not.toBe("");
    expect(ABSENT).toContain(GONE);
    expect(ABSENT).toContain(GONE_RETIRED);
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

describe("downloadFasta and the build's retired records", () => {
  test("a retired record stays in the file, is named in the file's order, and the note turns amber", async () => {
    for (const ids of [[A, R1, B, R2], [R2, C, R1]]) {
      const { saved, said } = await run(ids);
      expect(accessionsOf(saved[0]?.[1] ?? "")).toEqual(ids);
      const before = (await plain(ids)).text;
      expect(said.tone).toBe("warn");
      expect(said.text.startsWith(`${before} 2 of them are retired records`)).toBe(true);
      const names = ids.filter((id) => id === R1 || id === R2).map(nameOf);
      expect(names.every((x) => x !== "")).toBe(true);
      expect(said.text.endsWith(`: ${names.join(", ")}.`)).toBe(true);
    }
  });

  test("one retired record among others, and a file of that one record alone", async () => {
    const among = await run([A, R1]);
    expect(among.said.text).toContain(`One of them is a retired record`);
    expect(among.said.text.endsWith(`: ${nameOf(R1)}.`)).toBe(true);
    const alone = await run([R1]);
    expect(alone.said.text).toContain(`It is a retired record`);
    expect(alone.said.tone).toBe("warn");
  });

  test("only the records in the file are named: a retired one NCBI left out is not", async () => {
    const ids = [A, R1, GONE_RETIRED];
    const { saved, said } = await run(ids);
    expect(accessionsOf(saved[0]?.[1] ?? "")).toEqual([A, R1]);
    expect(said.text).toContain(GONE_RETIRED);
    expect(said.text.endsWith(`: ${nameOf(R1)}.`)).toBe(true);
    expect(said.text).not.toContain(nameOf(GONE_RETIRED));
  });

  test("no retired record, no sentence: the note is what ./fasta says", async () => {
    expect((await run([A, B, C])).said).toEqual(await plain([A, B, C]));
    expect((await run([A, GONE])).said).toEqual(await plain([A, GONE]));
  });

  test("a list that cannot be read is said as not checked, never as none; the file is still saved", async () => {
    for (const fail of [() => Promise.reject(new Error("HTTP 404")), async () => readRetired({ retired: "nope" })]) {
      const { saved, said } = await run([A, R1], { retired: fail });
      expect(accessionsOf(saved[0]?.[1] ?? "")).toEqual([A, R1]);
      expect(said.tone).toBe("warn");
      expect(said.text.startsWith((await plain([A, R1])).text)).toBe(true);
      expect(said.text).toContain("could not be checked");
      expect(said.text).not.toContain(nameOf(R1));
    }
    const alone = (await run([A], { retired: () => Promise.reject(new Error("HTTP 404")) })).said.text;
    expect(alone.endsWith("Whether it is a retired record could not be checked (HTTP 404).")).toBe(true);
    const two = (await run([A, B], { retired: () => Promise.reject(new Error("HTTP 404")) })).said.text;
    expect(two.endsWith("Whether any of them is a retired record could not be checked (HTTP 404).")).toBe(true);
  });

  test("nothing saved, nothing said about retired records, whatever the list says", async () => {
    const broken = () => Promise.reject(new Error("HTTP 404"));
    for (const [ids, status] of [[[R1, R2], 500], [[GONE_RETIRED], undefined]] as [string[], number | undefined][]) {
      for (const retired of [RETIRED, broken]) {
        const { saved, said } = await run(ids, { ...(status !== undefined ? { status } : {}), retired });
        expect(saved).toEqual([]);
        expect(said).toEqual(await plain(ids, status));
      }
    }
  });

  test("the sentences follow in order: the result, what was left out, the retired records", async () => {
    const leftOut = "1 row has no accession and was left out.";
    const { said } = await run([R1, A], { leftOut });
    const base = (await plain([R1, A])).text;
    expect(said.text.startsWith(`${base} ${leftOut} One of them is a retired record`)).toBe(true);
  });
});
