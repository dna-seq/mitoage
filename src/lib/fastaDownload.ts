/**
 * One FASTA download from start to finish, the same for every island that offers one: ask NCBI
 * for the records (./fasta), save the file when there is something to save, and say what
 * happened. Safe for islands.
 */
import { downloadText } from "./csv";
import { describeFasta, type FastaNote, fastaToSave, fetchFasta, type FetchFastaOptions } from "./fasta";

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
}

const n = (v: number): string => v.toLocaleString("en-US");

/**
 * Fetches the records of `accessions` (versioned RefSeq accessions, in the order wanted), saves
 * them as `filename` unless there is nothing to save, and returns what to tell the person.
 */
export async function downloadFasta(
  accessions: readonly string[],
  filename: string,
  opts: DownloadFastaOptions = {},
): Promise<DownloadNote> {
  const { onNote, leftOut, save, ...fetchOpts } = opts;
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
  return leftOut ? { tone: said.tone === "ok" ? "warn" : said.tone, text: `${said.text} ${leftOut}` } : said;
}
