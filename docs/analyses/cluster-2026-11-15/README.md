# Cluster analyses of 2026-11-14 and 15: mitoport interface, lifespan, structural alignments

Result tables of analyses run on the cluster host `haumea` by another agent (Claude Science), copied here
on 2026-11-15. **They were not reproduced in this repository**: the tables are the cluster's output files
byte for byte (renamed to this directory's UPPER_SNAKE rule, SHA-256 below), and the numbers quoted from
them in `docs/ANALYSIS_FINDINGS.md` (H3, H5, H9, H10) were recomputed from these files, not rerun. The
scripts, Slurm job files, logs and the cluster's own READMEs stay on the cluster, at the paths below. The
code is not yet in `dna-seq/mitoage-pipelines`.

## The tables

| file here | cluster file | what one row is |
| --- | --- | --- |
| `SITES.tsv` | `/data/uq2347/runs/mitoage/mitoport/iface/out/sites.tsv` | one residue of COX1, COX2 or COX3 in human PDB 5Z62, with its MitoAge alignment column, relative accessibility in the complex and in the isolated chain, its nuclear contact partners, column occupancy and identity to human across species, and its group: `contact` (touches a nuclear subunit, 4.5 Å heavy-atom cutoff; 298), `control` (a non-contact residue of the same gene matched by isolated-chain accessibility; 298), `other` (404) |
| `COUPLING.tsv` | `/data/uq2347/runs/mitoage/mitoport/iface/out/coupling.tsv` | one nuclear protein (61) and its group: the correlation over mammal pairs between its distances and the mitochondrial COX distances, patristic distance partialled out, for interface and other column sets, with two distances: `seq_` differing alignment columns, `esm_` ESM-2 650M per-residue embeddings averaged over the position set |
| `LIFESPAN.tsv` | `/data/uq2347/runs/mitoage/mitoport/iface/out/lifespan.tsv` | one phylogenetic regression of log10 maximum lifespan on a standardised per-species mismatch (contact, control, contact minus control), log10 adult mass in the model, Pagel's lambda on the dated tree, for three species sets |
| `WITHIN_SPECIES.tsv` | `/data/uq2347/runs/mitoage/struct/out/within_species.tsv` | one pair of chains of the human complexes (24 chains, 276 pairs; 78 among the 13 mitochondrially encoded proteins), superimposed with US-align: TM-score normalised by the shorter (`tm_short`) and the longer chain (`tm_long`), aligned residues, RMSD |
| `CHAINS.tsv` | `/data/uq2347/runs/mitoage/struct/out/chains.tsv` | one chain used above: gene, PDB entry, chain, length, and for the mitochondrial ones identity to MitoAge's human sequence |
| `STRUCTURAL_MSA.tsv` | `/data/uq2347/runs/mitoage/struct/out/structural_msa.tsv` | one gene: FoldMason structural alignment of 62 mammals' predicted structures against MAFFT L-INS-i on the same sequences, sum-of-pairs agreement overall and in the conserved core over 500 species pairs, and both tools' run time in seconds |
| `PLDDT.tsv` | `/data/uq2347/runs/mitoage/struct/pdbs/plddt.tsv` | one predicted structure (806 = 62 mammals × 13 genes); no header: gene, species, length, mean pLDDT |

Not copied: `/data/uq2347/runs/mitoage/mitoport/structure/out/5Z62.contacts.tsv` (1,245 atom-level contact
pairs, from which `SITES.tsv` is built; 298 distinct residues touch a nuclear subunit, 494 touch any other
chain), the 806 predicted structures (61 MB, `/data/uq2347/runs/mitoage/struct/pdbs/<GENE>/<species>.pdb`),
and the provisional Coevol runs (`/data/uq2347/runs/mitoage/rm12/out/coevol-repo/chain1.cov`,
`chain2.cov`; their numbers are in H3, marked provisional).

## Where the code and logs are

- Interface and lifespan (RM11): `/data/uq2347/runs/mitoage/mitoport/iface/` — `burial.py` and
  `burial.sbatch` (accessibility and the matched control; log `mitoport-burial-6484609.log`),
  `nucaln.sbatch` (MAFFT L-INS-i of the nuclear orthologs; `mitoport-nucaln-6484610.log`), `iface.py` and
  `iface.sbatch` (coupling and lifespan; `mitoport-iface-6484611.log`), and its `README.md`. The contact map
  is from `/data/uq2347/runs/mitoage/mitoport/structure/`.
- Structural alignments (RM13): `/data/uq2347/runs/mitoage/struct/` — `within.py`/`within.sbatch`,
  `fold.py`/`fold.sbatch` (the finished run is `struct-fold-6485024.log`; earlier fold logs are failed
  attempts), `smsa.py`/`smsa.sbatch` (`struct-msa-6485025.log`), and its `README.md`. That README names
  `facebook/esmfold_v1` as the folding model; `fold.py` loads `biohub/ESMFold2-Fast`, which is what ran.
- Coevol (RM12 step 4): `/data/uq2347/runs/mitoage/rm12/out/coevol-repo/`.

## Checks made here, and what they found

Recomputed from the files on 2026-11-15 (Python with SciPy, outside the repository):

- `SITES.tsv`: median identity to human 0.922 for contact residues against 0.971 for the matched control
  (Mann-Whitney p = 1.5e-05), as reported. The exposure contrast reported as "0.41 against 0.05" is contact
  residues against the `other` group, isolated chain; the matched controls are at 0.364, as the matching
  intends. Column occupancy across the 2,174 species of the run (the burial log's count) has median 1.000,
  but not every contact column is full: 290 of 298 are at 0.99 or above, and the lowest is COX1 position 2
  at 0.456.
- `COUPLING.tsv`: the group medians and p values match the iface log. Species per protein range from 87 to
  182 (166 to 181 for complex IV's subunits); seven cytosolic controls have fewer than 166 (LDHA 87).
  One contrast the log does not print: with ESM distances, complex IV's nuclear interface columns couple
  more than its other columns (`esm_excess_nuc`, median +0.051 against +0.004 for the controls, p = 0.0096,
  uncorrected), where the sequence distance gives −0.022 (p = 0.72).
- `LIFESPAN.tsv`: the 95% interval of the all-species slope, from slope and t, is [−0.050, +0.002]
  log10 years per standard deviation.
- `STRUCTURAL_MSA.tsv` and `PLDDT.tsv`: median agreement 0.9997 overall and 1.000 in the core; mean pLDDT
  84.8; correlation across genes between disagreement and mean pLDDT −0.03. The folding time (11,949 s for
  806 structures) is from `struct-fold-6485024.log`; the GPU type (A100) is the other agent's report.
- `CHAINS.tsv`: identity to MitoAge's human sequences 0.979 (ND4L) to 1.000.

## SHA-256 of the cluster files

```
fec65ef9b0c88a4d3974091af766ac6a0cdcc0be585696ed31888aeaf84e4cc4  chains.tsv          CHAINS.tsv
8ef90c4288ba7d4dfe742f22ef613dc14bb58a6270ee347913c89221aba49c81  coupling.tsv        COUPLING.tsv
225476f265a3f98c1e9b36020892e605f3a4257f702cfc9f8480d2afdb6b3645  lifespan.tsv        LIFESPAN.tsv
16304eaff32623c2e2978e47e445979db49609e8ed9ee5e91c8ecbefe053edd9  plddt.tsv           PLDDT.tsv
6f219d3a7d70e10fce1a5fdf8220b46eb813291eba1159376c17f7b1d0f5e4c7  sites.tsv           SITES.tsv
e2a18ead437e6945711b6b36073536aadda7f59ed4a9b025ef288f26c1d933f2  structural_msa.tsv  STRUCTURAL_MSA.tsv
0282e76574a540e2bd1d5e04450c1afba0ee2fbbaaadf1045d136feac1993818  within_species.tsv  WITHIN_SPECIES.tsv
dc712a025912e5d7fb418d94a88bfa23016533c74729849b54c4c8dcbc17395c  5Z62.contacts.tsv   (not copied)
96abfb679dfe926a5f79e3783b23ad56ae833235d664f530a47d919d584a4024  chain1.cov          (not copied)
a2d01f63dd64167919fa462237d549d787195c26b2e68c16ed423f42b3fe33b2  chain2.cov          (not copied)
```
