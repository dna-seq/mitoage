# Analysis findings

What the research arms of MitoAge found on build 2, as of 2026-11-14: longevity in the alignments of the
mitochondrial proteins, the peptides encoded inside mtDNA, and the pairing of mitochondrial proteins with
their nuclear partners (mitoport). Results that did not hold, and one mistake, are kept next to those that
did. Nothing here is peer reviewed and nothing of it is on the site.

The code is in [dna-seq/mitoage-pipelines](https://github.com/dna-seq/mitoage-pipelines); the commands named
below (`mitoage ...`) are that repository's, and this text is kept the same as its `docs/HYPOTHESES.md`. The
result tables are the Hugging Face dataset
[longevity-genie/mitoage-pipelines](https://huggingface.co/datasets/longevity-genie/mitoage-pipelines); the
prepared inputs are `mitoage-nuclear-partners`, `mitoage-embeddings` and `mitoage-aligner-variants` there.

**Not done**: structural alignments (RM13); the complexes section of the site with nuclear and mitochondrial
subunits side by side (RM17); anything about lifespan in the mito-nuclear pairing.

Each entry: the hypothesis as we held it, the test, the control that keeps the test honest, the result, and
its limits. Results that did not hold are kept next to those that did: a reader should see what was tried.
Numbers are from the runs of 2026-11-13 on build 2 of MitoAge (about 2,300 species with a mitochondrial
genome and a maximum lifespan); the command that produces each table is named. "Lifespan" is maximum
recorded lifespan, log10 years. Nothing here is peer reviewed.

## Data

- The MitoAge build: species table, lifespans, alignments of the 13 mitochondrial proteins (amino acids and
  codons) and of the two rRNA genes. `mitoage download build`.
- Nuclear orthologs of respiratory-complex subunits and of control proteins, from NCBI's ortholog sets.
  `mitoage download orthologs`.

## H0. The alignments do not depend on the aligner

**Why it matters.** Every site-level result below reads alignment columns.
**Test.** MAFFT (fast, as shipped), MAFFT iterative, FAMSA 2, Muscle 5 on each protein; the share of residue
pairs the shipped alignment puts in one column that another tool also puts in one column.
`mitoage longevity compare-aligners`.
**Result.** At least 0.985 with every tool for COX1, COX2, COX3, CYTB, ND1. Soft: ND6 (0.87 to 0.97), ATP8
(0.92 to 0.99), ND5 (0.96 to 0.99).
**Consequence.** A site-level finding in a soft gene is kept only if it holds on a second alignment.
**Limit.** Agreement between tools is not correctness: there is no reference alignment.

## H1. Amino-acid content of mitochondrial proteins follows lifespan (positive controls)

**Hypothesis.** Published: long-lived animals have fewer cysteines and more threonine in mitochondrially
encoded proteins; methionine is debated. If our data and method are sound, these come back.
**Test.** Content of each amino acid over the 13 proteins against lifespan. `mitoage longevity controls`.
**Controls.** Body mass; relatedness as comparison within families and as random effects of order and
family; base composition at fourfold-degenerate sites (`mitoage longevity fourfold`,
`mitoage longevity composition`), because amino acids with C-rich codons rise and those with T-rich codons
fall with lifespan, which is what a shift in mutation pressure alone would do.
**Result, mammals (622 with body mass).** Threonine up (+0.30 percentage points per tenfold lifespan after
composition, p = 0.0005), cysteine down (−0.05, p = 0.00008). Methionine: nothing (p = 0.4). Isoleucine and
phenylalanine fall, leucine rises; about 40 % of the isoleucine and phenylalanine effects and all of
proline's are base composition.
**Result, other classes.** Nothing for cysteine or methionine in birds, ray-finned fishes or reptiles;
threonine goes the other way in fishes with body mass (235 species only).
**Lesson.** Without any control for relatedness threonine has p = 1e-60 across all species; within families
it is 0.9. The raw figure is the difference between classes.

## H2. Single residues are associated with lifespan

**Hypothesis.** Some positions of the 13 proteins carry a residue more often in long-lived species,
independently in several lineages.
**Test.** Each alignment column and residue (present in at least 15 species and absent in 15, both states
in at least 5 families) against lifespan, body mass and fourfold composition in the model.
**First version, kept as a warning.** Comparison within families (`mitoage longevity sites`): 226 of 5,017
tests pass a 10 % false-discovery threshold, but the p-values are inflated over the whole range. Genera
inside a family are not independent.
**Fixed before any result.** The tree is the build's dated species tree (Open Tree topology, TimeTree
dates), never one made from these genes; lifespan records of high or acceptable quality only.
**Second version, and a mistake.** A phylogenetic regression with Pagel's lambda
(`mitoage longevity pgls`). It was first run on a tree built from the 13 proteins themselves and on every
lifespan record, against the rule above. That run gave cytochrome b position 43 (methionine, q = 0.03) as
"the one site". Rerun as fixed (dated tree, quality filter), that site has q = 0.29.
**Result as fixed, mammals (604).** P-values are flat. Two columns pass at 5 % false discovery:
- ND5 position 200 (human numbering): histidine in place of glutamine. It is the marsupials (24 of 28
  carriers): one old change in one clade. Not a longevity site on this evidence.
- COX1 position 419: isoleucine in 24 species with about 40 % longer lifespan given body mass
  (p = 2e-5, q = 0.049): great apes, elephants, bears, African mole-rats and single species in eight other
  families. On the gene-built tree it had q = 0.27.
**Result as fixed, birds (379).** Nothing (smallest p 0.001).
**Conclusion.** No single residue is robustly associated with lifespan in mammals or birds: the one or two
columns near the threshold change place with the tree, and among about 1,650 columns that is what chance
gives. The gene-built tree remains available (`mitoage longevity concat`, `mitoage longevity tree`) only to
show this sensitivity.

## H3. Selection on mitochondrial genes differs between long-lived and short-lived lineages

**Hypothesis.** Purifying selection is stronger (better-protected mitochondria) or weaker (smaller
populations) in long-lived lines.
**Test.** HyPhy RELAX per gene; species long-lived and short-lived for their body mass, in equal numbers
from each end within each order, at most three per family; tips labelled. `mitoage longevity relax-prep`,
`mitoage longevity relax`.
**Control.** A second draw of species disjoint from the first.
**Result.** First draw (57 against 57): ND3 relaxed (K = 0.71, p = 0.0008) and cytochrome b relaxed
(K = 0.51, p = 0.003). Second draw (48 against 48, a weaker contrast by construction): neither repeats
(ND3 K = 0.89, p = 0.38; CYTB K = 1.03, p = 0.52); ATP8 appears there only. **No gene shows a difference
that holds across both draws.** We do not claim the first draw's hits.
**Open.** Lifespan as a continuous trait on every branch (Coevol on the dated tree; inputs by
`mitoage longevity coevol-prep`). The RELAX runs above used the gene-built tree for their species tree;
`relax-prep` now writes the dated one, and the runs have not been repeated on it.

## H4. Peptides encoded inside mtDNA are conserved across species

**Hypothesis.** The published mitochondrial-derived peptides (humanin, SHLP6, MOTS-c inside the rRNA genes;
MTALTND4 in another frame of ND4) are kept as open reading frames beyond human, and their presence follows
lifespan.
**Test.** Find each peptide in the human row, project its columns onto every species, ask for a start codon
and no stop before 90 % of the length. `mitoage peptides pilot`.
**Control.** Other windows of the same length in the same gene (and frame) that are stop-free in human.
**Result.** All four are found in human with the published sequence. Across species only SHLP6 looks kept
(start codon in every vertebrate with the region, frame open in 88 to 97 % per class); humanin is open in
89 % of mammals but keeps its ATG in 74 %; MOTS-c is no better than a random open window of 12S; MTALTND4 is
kept in 36 of 116 primates. **None is beyond the null**: 10 to 14 % of random 16S windows open in human are
kept as widely as SHLP6.
**Limits.** A kept frame is not a translated peptide; nuclear copies are out of sight; outside vertebrates
the windows do not line up. The test against the host gene's synonymous codons shuffled is not done.

## H5. Mitochondrial and nuclear subunits of one complex evolve together (mitoport)

**Hypothesis.** Nuclear subunits that touch mitochondrially encoded ones change rate on the same branches,
more than nuclear proteins that do not; and this pairing differs with lifespan.
**Test.** Rate covariation: one fixed tree, branch lengths per protein, each nuclear protein's rate relative
to cytosolic control proteins, each mitochondrial complex's rate relative to the mean of the 13
mitochondrial proteins, correlation over branches. `mitoage mitoport select`, `align`, `branch-lengths`,
`erc`.
**Controls.** Cytosolic proteins; complex II (no mitochondrial subunit); mitochondrial matrix enzymes.
**Result (62 mammals with all 67 proteins, dated species tree).** Complex IV's eleven nuclear subunits follow
the mitochondrial COX genes (median correlation +0.14 against +0.01 for 23 cytosolic controls, p = 0.004),
and not cytochrome b (−0.17). Complex III's nine nuclear subunits against cytochrome b: nothing (−0.11
against −0.06). On the topology of the tree built from the proteins the same test gave p = 0.0001; the
direction and size are the same, the dated tree is the one that counts. This reproduces a known phenomenon
and serves as the method's positive control. **Nothing about lifespan yet.**
**Traps met.** IQ-TREE re-places identical sequences unless told `--keep-ident`, which silently changes the
tree; NCBI's ortholog sets for CYC1, SDHC and SDHD held 21 to 48 sequences of another gene or a broken
model, filtered by identity to human; a test of nuclear rate against overall mitochondrial rate with one
shared denominator is invalid and is not reported.
**Open.** More species (pairwise instead of complete matrix); contact against non-contact residues on the
solved structures; the pairing against lifespan; embeddings of both partners from a protein language model.

## H6. Partners' protein-language-model embeddings move together across species (mitoport)

**Hypothesis.** If nuclear and mitochondrial subunits co-evolve, the distance between two species in the
embedding of a nuclear subunit follows the distance in the embeddings of its mitochondrial partners, beyond
what the time separating the species explains.
**Test.** ESM-2 650M, mean over residues, for 61 nuclear proteins and the 13 mitochondrial ones in up to 182
mammals (embeddings computed in the kron-fm project). Per nuclear protein: partial correlation over species
pairs of its cosine distances with those of a mitochondrial complex's subunits, given patristic distance on
the dated tree and its logarithm.
**Controls.** Cytosolic proteins; complex II; mitochondrial matrix enzymes. Because species pairs are not
independent, only the comparison between groups of proteins is tested.
**Result.** Complex IV nuclear subunits +0.34 with the mitochondrial COX proteins (cytosolic controls
+0.03, p = 0.0004), complex III nuclear +0.23 (p = 0.005), cytochrome c +0.41; complex II +0.05 and matrix
enzymes +0.02, like the controls. **Not complex-specific**: complex IV's nuclear subunits follow the
mitochondrial subunits of complexes III, I and V almost as well (+0.31, +0.27, +0.20).
**Reading.** Nuclear proteins that share a complex with mtDNA products change more where the mitochondrial
genome changes more; being mitochondrial without such a partner is not enough. The common cause is
probably the lineage's mitochondrial rate, which the tree's time does not remove.
**Open.** The coupling against lifespan; per-residue embeddings at contact and non-contact positions.
