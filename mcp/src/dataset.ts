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
  revision: "0f4e970554b2fe0265e718321f422347293dde17",
  file: "mitoage.sqlite",
  sha256: "a105cecce222954842b6a346c82b1e88a8711de86911e657dd76d5c172429a67",
  build: "2 (2026-11-15: the EURING birds and the parrot's ND6)",
};

export const downloadUrl = (pin: DatasetPin, revision: string): string =>
  `https://huggingface.co/datasets/${pin.repo}/resolve/${revision}/${pin.file}`;
