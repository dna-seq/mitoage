# Coevolution of mitochondrial and nuclear proteins

Tables of the mitoport analyses of mitoage-pipelines (https://github.com/dna-seq/mitoage-pipelines), copied without changing a value
from the Hugging Face dataset `longevity-genie/mitoage-pipelines` at revision `126d2371c337542f341ee00ef9ec30544edf24b8`
(https://huggingface.co/datasets/longevity-genie/mitoage-pipelines/tree/126d2371c337542f341ee00ef9ec30544edf24b8/output/mitoport), retrieved 2026-11-16. Each file here is
the file of the same path under `output/mitoport/` there, as parquet; `mitoport.json` gives each source
file's SHA-256, which `bun run mitoport` checks before it writes anything.

**Which build.** Not the build the rest of this folder holds: the MitoAge build at Hugging Face revision
`c525adb` of `longevity-genie/mitoage` (2,335 species). The complex IV and H12 tables (iface/, partners.tsv, partners_species.tsv) were computed on c525adb; erc.tsv and coembed.tsv come from the runs of 2026-11-13 on build 2, before its first upload to Hugging Face. Species are named by slug, which does not change between builds; alignment
columns (`aln_col` in `iface/contact_map/`) are columns of that build's alignments, not of
`alignments/` here.

**What they are for.** None of these features follows lifespan: mismatch at complex IV's mito-nuclear
contacts (H9) and discordance of its contact pairs (H12) give intervals that include zero in every set and
class tested. The tables are offered for reuse in studies of mito-nuclear coevolution, not as a longevity
signal. What each analysis did and found: https://github.com/dna-seq/mitoage-pipelines/blob/main/docs/HYPOTHESES.md (H5, H6, H9, H12).

| File | Rows | Finding | What it holds |
| --- | --- | --- | --- |
| `erc.parquet` | 54 | H5 | Rate covariation over the branches of the dated tree (62 mammals): per nuclear protein, the correlation of its relative rate with that of complex IV's (COX1-3) and complex III's (CYTB) mitochondrial subunits. |
| `coembed.parquet` | 61 | H6 | ESM-2 embedding covariation: per nuclear protein, the partial correlation over pairs of mammals of its embedding distance with that of the mitochondrial subunits of complexes IV, III, I and V, time on the dated tree partialled out. |
| `iface/coupling.parquet` | 61 | H5 | Residue-level coupling with complex IV: per nuclear protein, the partial correlation over pairs of mammals between its distances and the COX1-3 distances at contact and at burial-matched control residues, by sequence (seq_) and by ESM-2 embedding (esm_). |
| `iface/lifespan.parquet` | 9 | H9 | Lifespan on mismatch at complex IV's contact residues (COX1-3 side): phylogenetic regression slopes with 95% intervals, all species, mammals, and the species with nuclear partners. |
| `partners.parquet` | 20 | H12 | Lifespan on discordance of complex IV's mito-nuclear contact pairs, per class and model: slope per standard deviation, 95% interval, p and q. |
| `partners_species.parquet` | 316 | H12 | Every species' discordance at complex IV's mito-nuclear contact pairs and at control pairs (share of pairs where exactly one side differs from its class's consensus), with the pairs counted. |
| `iface/contact_map/chains.parquet` | 14 | H5 | The chains of human complex IV (PDB 5Z62): gene, mitochondrial or nuclear, residues. |
| `iface/contact_map/contacts.parquet` | 1245 | H5 | Every residue pair of COX1-3 and another chain of PDB 5Z62 within 4.5 Å (heavy atoms). |
| `iface/contact_map/sites.parquet` | 1000 | H5 | Every COX1-3 residue of PDB 5Z62 with its column in the MitoAge alignment, accessibility in the complex and alone, nuclear contact partners, occupancy, identity to human and group (contact, control or neither). |
| `iface/contact_map/control_pairs.parquet` | 298 | H5 | Which burial-matched non-contact residue each contact residue took as its control. |
| `iface/contact_map/species.parquet` | 2174 | H5 | The species (slugs) the contact map's occupancy and identity columns are computed over. |

An empty cell in the source is null here: not assessed (too few species or pairs), never zero. Column
names with spaces got underscores: `partners_species.parquet`: "contact minus control" is `contact_minus_control`.

The nuclear ortholog sets and their alignments are in `longevity-genie/mitoage-nuclear-partners` at revision
`7deb2e00035fdfbc482f1bc05979af4b358d1253` (https://huggingface.co/datasets/longevity-genie/mitoage-nuclear-partners/tree/7deb2e00035fdfbc482f1bc05979af4b358d1253).

Licence: CC BY 4.0 (the dataset card: "Tables computed here: CC BY 4.0"). Nothing here is peer reviewed.
