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
  revision: null,
  file: "mitoage.sqlite",
  sha256: null,
  build: null,
};

export const downloadUrl = (pin: DatasetPin, revision: string): string =>
  `https://huggingface.co/datasets/${pin.repo}/resolve/${revision}/${pin.file}`;
