/**
 * One FASTA download from start to finish, the same for every island that offers one: ask NCBI
 * for the records (./fasta), save the file when there is something to save, and say what
 * happened, naming any retired record of the build the file holds (./retired). Safe for islands.
 */
import { downloadText } from "./csv";
import { describeFasta, type FastaNote, fastaToSave, fetchFasta, type FetchFastaOptions } from "./fasta";
import { loadRetired, type RetiredRecord, retiredSentence } from "./retired";

/** What an island shows during and after a download; `info` is a download still running. */
export interface DownloadNote {
  tone: "info" | FastaNote["tone"];
  text: string;
}

export interface DownloadFastaOptions extends Omit<FetchFastaOptions, "onProgress"> {
  /** Told what is happening while the requests run. */
  onNote?: (note: DownloadNote) => void;
  /**
   * A sentence about the part of the selection that has no accession and so was not asked for.
   * It follows the result, and a download that is otherwise complete becomes a warning.
   */
  leftOut?: string;
  /** Saves the file: the browser's download by default (tests pass their own). */
  save?: (filename: string, text: string) => void;
  /** The build's retired records by accession: /species/retired.json by default (tests pass their own). */
  retired?: () => Promise<ReadonlyMap<string, RetiredRecord>>;
}

const n = (v: number): string => v.toLocaleString("en-US");

/**
 * Fetches the records of `accessions` (versioned RefSeq accessions, in the order wanted), saves
 * them as `filename` unless there is nothing to save, and returns what to tell the person. A
 * retired record stays in the file, since it is one of the rows asked for, and is named; when the
 * list of retired records cannot be read, the note says that this was not checked.
 */
export async function downloadFasta(
  accessions: readonly string[],
  filename: string,
  opts: DownloadFastaOptions = {},
): Promise<DownloadNote> {
  const { onNote, leftOut, save, retired, ...fetchOpts } = opts;
  // Asked alongside NCBI; a failure is kept as an answer, never thrown.
  const lookup = (retired ?? loadRetired)().then(
    (map) => ({ ok: true as const, map }),
    (e: unknown) => ({ ok: false as const, detail: e instanceof Error ? e.message : String(e) }),
  );
  onNote?.({
    tone: "info",
    text: `Fetching ${n(accessions.length)} ${accessions.length === 1 ? "sequence" : "sequences"} from NCBI…`,
  });
  const result = await fetchFasta(accessions, {
    ...fetchOpts,
    onProgress: (done, total) => onNote?.({ tone: "info", text: `Fetching sequences from NCBI: ${n(done)} of ${n(total)}…` }),
  });
  const file = fastaToSave(result);
  if (file !== null) (save ?? ((name, text) => downloadText(name, text, "text/x-fasta")))(filename, file);
  const said = describeFasta(result, filename);
  const parts = [said.text];
  let tone = said.tone;
  const add = (sentence: string) => {
    parts.push(sentence);
    if (tone === "ok") tone = "warn";
  };
  if (leftOut) add(leftOut);
  if (file !== null && result.kind !== "failed") {
    // The file holds what was asked for, once each and in that order, less what NCBI left out.
    const missing = new Set(result.kind === "incomplete" ? result.missing : []);
    const inFile = [...new Set(accessions)].filter((id) => !missing.has(id));
    const check = await lookup;
    if (check.ok) {
      const sentence = retiredSentence(inFile.flatMap((id) => check.map.get(id) ?? []), inFile.length);
      if (sentence) add(sentence);
    } else
      add(`Whether ${inFile.length === 1 ? "it" : "any of them"} is a retired record could not be checked (${check.detail}).`);
  }
  return { tone, text: parts.join(" ") };
}
