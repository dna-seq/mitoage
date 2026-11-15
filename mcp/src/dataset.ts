/**
 * Which published build this server reads.
 *
 * `revision` is a commit of the Hugging Face dataset, never a branch: a database that is cited has
 * to give the same answer tomorrow, and `main` does not promise that. It is null until the build is
 * uploaded, and a null stops the server with the reason rather than quietly fetching the newest
 * file; `MITOAGE_DB` points at a local database meanwhile, which is how the repository's own tests
 * and a reviewer with the file in hand run it. The release workflow refuses to publish while it is
 * null, so a published version always names a build.
 */
export interface DatasetPin {
  /** The Hugging Face dataset, owner and name. */
  repo: string;
  /** A full commit SHA of that dataset, or null while the build is not uploaded. */
  revision: string | null;
  /** The file within the dataset. */
  file: string;
  /** Lowercase hex SHA-256 of that file, or null when it is not known yet. */
  sha256: string | null;
  /** The build this pin is, for the message the server prints. */
  build: string | null;
}

export const DATASET: DatasetPin = {
  repo: "longevity-genie/mitoage",
  revision: "c525adbff8c12b19981fdada7f1615c2559b7140",
  file: "mitoage.sqlite",
  sha256: "b4f7dd75f5b11321ef8131c669d179ba928023ae4a71fd880dabd842ad11363f",
  build: "2 (2026-11-13)",
};

export const downloadUrl = (pin: DatasetPin, revision: string): string =>
  `https://huggingface.co/datasets/${pin.repo}/resolve/${revision}/${pin.file}`;
