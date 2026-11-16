/**
 * The coevolution tables of mitoage-pipelines (its "mitoport" analyses, H5, H6, H9 and H12 of its
 * docs/HYPOTHESES.md), pinned to one revision of the Hugging Face dataset that publishes them (D20).
 * `bun run mitoport` fetches each file into data/cache/mitoport/<revision>/, refuses it unless its SHA-256
 * is the one pinned here, and writes it as parquet under public/data/mitoport/.
 *
 * The SHA-256 values were computed on 2026-11-16 from files whose git blob ids matched the ids Hugging
 * Face's tree listing gives for this revision, so the pin is the hub's content, not a local copy.
 */

export interface MitoportFile {
  /** Path inside the dataset, under output/mitoport/. */
  path: string;
  sha256: string;
  bytes: number;
  /** What the table holds, said on the downloads page and in the README. */
  description: string;
  /** The finding of mitoage-pipelines it belongs to. */
  hypothesis: string;
}

export const MITOPORT_DATASET = "longevity-genie/mitoage-pipelines";
export const MITOPORT_REVISION = "126d2371c337542f341ee00ef9ec30544edf24b8";
export const MITOPORT_RETRIEVED = "2026-11-16";
export const MITOPORT_LICENSE = "CC BY 4.0 (the dataset card: \"Tables computed here: CC BY 4.0\")";
export const MITOPORT_CODE = "https://github.com/dna-seq/mitoage-pipelines";
export const MITOPORT_HYPOTHESES = "https://github.com/dna-seq/mitoage-pipelines/blob/main/docs/HYPOTHESES.md";

/** Where the nuclear ortholog sets and their alignments are; linked, not fetched. */
export const NUCLEAR_PARTNERS_DATASET = "longevity-genie/mitoage-nuclear-partners";
export const NUCLEAR_PARTNERS_REVISION = "7deb2e00035fdfbc482f1bc05979af4b358d1253";

/**
 * The MitoAge build the tables were computed on. The dataset card says so for the complex IV and H12 tables
 * (iface/, partners*); erc.tsv and coembed.tsv come from the runs of 2026-11-13 on build 2, before that
 * build's first upload, which the hypotheses record names as the build its numbers are from.
 */
export const MITOPORT_COMPUTED_ON = {
  dataset: "longevity-genie/mitoage",
  revision: "c525adbff8c12b19981fdada7f1615c2559b7140",
  species: 2335,
  /** Said wherever the build is: which tables the card's statement covers, and what is known of the others. */
  note:
    "The complex IV and H12 tables (iface/, partners.tsv, partners_species.tsv) were computed on c525adb; erc.tsv and coembed.tsv come from the runs of 2026-11-13 on build 2, before its first upload to Hugging Face.",
} as const;

export const MITOPORT_FILES: readonly MitoportFile[] = [
  {
    path: "erc.tsv",
    sha256: "c525c8a7067e7a8dbbf4e2ad61e63f1eef745d2d1c642970fd988c4d753cc3bc",
    bytes: 2117,
    hypothesis: "H5",
    description:
      "Rate covariation over the branches of the dated tree (62 mammals): per nuclear protein, the correlation of its relative rate with that of complex IV's (COX1-3) and complex III's (CYTB) mitochondrial subunits.",
  },
  {
    path: "coembed.tsv",
    sha256: "0f9160837001274a0fd8d2063845c2548f5e28641df51c12c630ae271d49ee4b",
    bytes: 3342,
    hypothesis: "H6",
    description:
      "ESM-2 embedding covariation: per nuclear protein, the partial correlation over pairs of mammals of its embedding distance with that of the mitochondrial subunits of complexes IV, III, I and V, time on the dated tree partialled out.",
  },
  {
    path: "iface/coupling.tsv",
    sha256: "8ef90c4288ba7d4dfe742f22ef613dc14bb58a6270ee347913c89221aba49c81",
    bytes: 8084,
    hypothesis: "H5",
    description:
      "Residue-level coupling with complex IV: per nuclear protein, the partial correlation over pairs of mammals between its distances and the COX1-3 distances at contact and at burial-matched control residues, by sequence (seq_) and by ESM-2 embedding (esm_).",
  },
  {
    path: "iface/lifespan.tsv",
    sha256: "ccdafd057fa9611c0aca77e958f4a3fac6f467c72f7fc283c9ea97dddeca4a28",
    bytes: 837,
    hypothesis: "H9",
    description:
      "Lifespan on mismatch at complex IV's contact residues (COX1-3 side): phylogenetic regression slopes with 95% intervals, all species, mammals, and the species with nuclear partners.",
  },
  {
    path: "partners.tsv",
    sha256: "3e9a203283b9ee165ee029dc9e4748bb906f8df25645332d360e155a5adb1185",
    bytes: 2457,
    hypothesis: "H12",
    description:
      "Lifespan on discordance of complex IV's mito-nuclear contact pairs, per class and model: slope per standard deviation, 95% interval, p and q.",
  },
  {
    path: "partners_species.tsv",
    sha256: "48e2ebaa892ee7011607a176f6b9ec539838aedde35ab64a3a9a5649ee59d610",
    bytes: 19119,
    hypothesis: "H12",
    description:
      "Every species' discordance at complex IV's mito-nuclear contact pairs and at control pairs (share of pairs where exactly one side differs from its class's consensus), with the pairs counted.",
  },
  {
    path: "iface/contact_map/chains.tsv",
    sha256: "853d29226eccebf977fc6d9dd6973107b7e1e515b5917a18f5c1753a34a44df5",
    bytes: 808,
    hypothesis: "H5",
    description: "The chains of human complex IV (PDB 5Z62): gene, mitochondrial or nuclear, residues.",
  },
  {
    path: "iface/contact_map/contacts.tsv",
    sha256: "dc712a025912e5d7fb418d94a88bfa23016533c74729849b54c4c8dcbc17395c",
    bytes: 87528,
    hypothesis: "H5",
    description: "Every residue pair of COX1-3 and another chain of PDB 5Z62 within 4.5 Å (heavy atoms).",
  },
  {
    path: "iface/contact_map/sites.tsv",
    sha256: "6f219d3a7d70e10fce1a5fdf8220b46eb813291eba1159376c17f7b1d0f5e4c7",
    bytes: 71482,
    hypothesis: "H5",
    description:
      "Every COX1-3 residue of PDB 5Z62 with its column in the MitoAge alignment, accessibility in the complex and alone, nuclear contact partners, occupancy, identity to human and group (contact, control or neither).",
  },
  {
    path: "iface/contact_map/control_pairs.tsv",
    sha256: "e6c1923d2d051f24ac302535bcd003c90cc02f7f1e8696569aa6811b59f80298",
    bytes: 6005,
    hypothesis: "H5",
    description: "Which burial-matched non-contact residue each contact residue took as its control.",
  },
  {
    path: "iface/contact_map/species.txt",
    sha256: "54706d4569b7e4bac1029d507e6cd182e7ef5af565aa61f9b57c8abfe76ec37a",
    bytes: 41763,
    hypothesis: "H5",
    description: "The species (slugs) the contact map's occupancy and identity columns are computed over.",
  },
];

export const mitoportUrl = (path: string): string =>
  `https://huggingface.co/datasets/${MITOPORT_DATASET}/resolve/${MITOPORT_REVISION}/output/mitoport/${path}`;

export const mitoportTreeUrl = (dataset: string, revision: string, folder = ""): string =>
  `https://huggingface.co/datasets/${dataset}/tree/${revision}${folder ? `/${folder}` : ""}`;
