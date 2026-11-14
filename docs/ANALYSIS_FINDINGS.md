# Analysis findings

What the research arms of MitoAge found on build 2, as of 2026-11-14: longevity in the alignments of the
mitochondrial proteins, the peptides encoded inside mtDNA, the pairing of mitochondrial proteins with
their nuclear partners (mitoport), the substitution rates of the 13 proteins, and the mtDNA motif, repeat
and deletion-contact-zone features. Results that did not hold, and one mistake, are kept next to those that
did. Nothing here is peer reviewed and nothing of it is on the site.

The code is in [dna-seq/mitoage-pipelines](https://github.com/dna-seq/mitoage-pipelines); the commands named
below (`mitoage ...`) are that repository's, and this text is kept the same as its `docs/HYPOTHESES.md`. The
result tables are the Hugging Face dataset
[longevity-genie/mitoage-pipelines](https://huggingface.co/datasets/longevity-genie/mitoage-pipelines); the
prepared inputs are `mitoage-nuclear-partners`, `mitoage-embeddings` and `mitoage-aligner-variants` there.

**Not done**: structural alignments (RM13); the complexes section of the site with nuclear and mitochondrial
subunits side by side (RM17); anything about lifespan in the mito-nuclear pairing; the long-read-only
replication of H8, because no record in the build states its sequencing technology (RM18); the
extended features in the plot explorer (RM19).

Each entry: the hypothesis as we held it, the test, the control that keeps the test honest, the result, and
its limits. Results that did not hold are kept next to those that did: a reader should see what was tried.
Numbers are from the runs of 2026-11-13 on build 2 of MitoAge (H1 and H2's power and second-alignment
checks: 2026-11-14, dataset revision 6efa0959282e, on which `controls` and `composition` give the numbers of
2026-11-13 again) (about 2,300 species with a mitochondrial
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

## H1. Amino-acid content of mitochondrial proteins follows lifespan

**Hypothesis.** Published, and contested. Long-lived animals have fewer cysteines in their mitochondrially
encoded proteins (Moosmann & Behl 2008, Aging Cell 7:32) and less methionine (Aledo et al. 2011, Aging Cell
10:198); higher primates gained threonine in the transmembrane regions of these proteins (Kitazoe et al. 2008,
PLoS ONE 3:e3343, doi:10.1371/journal.pone.0003343). Against this, Aledo, Valverde & de Magalhães (2012, J Mol
Evol 74:332, doi:10.1007/s00239-012-9510-7), on 173 mammals, found no effect of longevity on cysteine content
and threonine usage fully accounted for by nucleotide composition. We test all 20 amino acids and read
cysteine, threonine and methionine against this record; none of them is a positive control.
**Test.** Content of each amino acid over the 13 proteins (percent) against log10 lifespan, with log10 adult
body mass, and then also with base composition at fourfold-degenerate sites (shares of A, C and T), as a
phylogenetic regression on the build's dated species tree, with Pagel's lambda estimated for each amino acid
and model. Slopes are percentage points per tenfold lifespan; q is Benjamini–Hochberg over the 20 amino
acids, within class and model. `mitoage longevity aa-pgls --class <Class>` (after `controls`, `fourfold` and
`dated-tree`), into `aa_pgls.<Class>.tsv`, which also holds the earlier mixed model (random intercepts of
order and family) refitted on the same species (method `mixed`).
**Species.** The manuscript's default dataset: not retired, lifespan record of high or acceptable quality and
not estimated; with body mass; a tip of the dated tree. Mammals: 625 with all 13 proteins and a lifespan,
615 in the default dataset (10 questionable lifespans out), 612 with body mass, 604 in the tree (8 species
are not in it). Birds 379, ray-finned fishes 235, reptiles 97.
**Result, mammals (604).** Lambda is 0.96 to 1 for every amino acid: content follows the tree almost as
Brownian motion would. With body mass and composition **no amino acid passes q < 0.05**; the smallest q is
0.11 (alanine −0.13, p = 0.009; aspartate −0.045, p = 0.011; isoleucine −0.16, p = 0.016). Threonine +0.15
(p = 0.03, q = 0.12), cysteine −0.021 (p = 0.05, q = 0.15), methionine +0.004 (p = 0.94); histidine +0.05 and
glycine +0.035 (q = 0.12 and 0.13); the other twelve have p > 0.1. With body mass only five pass: isoleucine
−0.26 (q = 0.004), histidine +0.07, glycine +0.05, phenylalanine −0.09 and threonine +0.18 (q 0.03 to 0.045);
cysteine does not (−0.017, p = 0.10). Composition takes about a sixth of threonine's slope and two fifths of
isoleucine's.
**What changed the result: the tree, not the species set.** The earlier mixed model on the same 604 species
still gives seven amino acids at q < 0.05 with composition: isoleucine −0.35, cysteine −0.052 (q = 0.0006),
leucine +0.24, phenylalanine −0.15, aspartate −0.062, threonine +0.30 (q = 0.002) and alanine −0.17. Random
intercepts of order and family leave most of the shared ancestry in the residual; the dated tree, with lambda
near 1, takes it out: threonine's slope halves and cysteine's falls by more than half.
**Result, other classes, with composition.** Nothing at q < 0.05 in birds (smallest p 0.019), ray-finned
fishes (0.005) or reptiles (0.004); cysteine and methionine have p ≥ 0.15 in all three. Threonine goes the
other way in fishes (−0.076, p = 0.02, q = 0.17; with body mass only −0.094, q = 0.03). Whatever is seen in
mammals is not shared across vertebrates.
**Reading.** On the dated tree the published directions are there in mammals (threonine up, cysteine down)
at about half the size the mixed model gave, and neither is beyond chance among 20 amino acids once
composition is in the model; methionine shows nothing. This agrees with Aledo et al. 2012 on cysteine, and
on threonine as far as composition and relatedness together go. It does not test Kitazoe et al.'s claim,
which is about transmembrane regions in higher primates, not whole proteins across mammals.
**Limits.** Composition is three shares of fourfold sites over the 12 heavy-strand genes, a coarse measure of
mutation pressure; the tree's polytomies are kept as they are; one lifespan per species.
**Earlier version (runs of 2026-11-13), kept as a lesson.** 622 mammals with body mass, including the 10 with
questionable lifespans; mixed model of order and family (`mitoage longevity controls`, `composition`):
threonine +0.30 (p = 0.0005) and cysteine −0.05 (p = 0.00008) were reported as positive controls; alanine
(−0.175, p = 0.0005) and aspartate (−0.06, p = 0.0006), as significant, were not reported. Without any control
for relatedness threonine has p = 1e-60 across all species; within families it is 0.9.

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
**Second alignment (H0's rule for the soft gene ND5).** Rerun on the FAMSA, Muscle 5 and iterative MAFFT
alignments of the same sequences (`mitoage download prepared --topic aligners`, then `mitoage longevity
pgls --alignments-dir data/interim/aligners --tool <tool> --out ...`): in each, both columns hold the same
residues in the same species (573 glutamine and 28 histidine at ND5 200, 24 isoleucine at COX1 419) and
come first and second, with q = 0.005 and 0.049. They stand on the alignment; what is said of them above
does not change.
**Power** (`mitoage longevity pgls-power`). With the standard errors the tests themselves have, a lone column
passes 5 % false discovery (p ≤ 0.05/5,259 = 9.5 × 10⁻⁶) with 80 % power only if its residue changes lifespan,
given mass and composition, by 0.17 log10 years (1.49-fold) with 20 to 29 carriers, 0.13 (1.35-fold) with 50
to 99, and 0.10 (1.27-fold) with 200 to 399. Half the tests have 85 carriers or fewer. COX1 419 (0.146 with
24 carriers) is below what the screen finds reliably.
**Conclusion.** No single residue is robustly associated with lifespan in mammals or birds: the one or two
columns near the threshold change place with the tree, and among about 1,650 columns that is what chance
gives. The screen can see only large effects, of about 1.3- to 1.5-fold lifespan. The gene-built tree remains available (`mitoage longevity concat`, `mitoage longevity tree`) only to
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

## H7. Lifespan predicts the substitution rate of the mitochondrial proteins

**Hypothesis.** Published, and contested in both directions: long-lived lineages have been reported with
slower mitochondrial substitution rates in bivalves (Sacco et al. 2021, Front Mol Biosci,
doi:10.3389/fmolb.2021.626042) and in fishes (doi:10.1098/rstb.2025.0085), while a survey across
vertebrates found that whether the association appears at all depends on how the rate is normalised
(Hernandez-Pacheco et al. 2026, GBE, doi:10.1093/gbe/evag067). The caveat is the reason to test it here.
**Test.** The relative-rate test on cherries of the dated tree. Two tips sharing a parent have had the same
time since they split, so measuring each against one common outgroup makes the rate difference a contrast
that needs no divergence-time correction. dN and dS are Nei-Gojobori counts with the Jukes-Cantor
correction, in each species' own mitochondrial code, averaging codon pairs that differ more than once over
every pathway that avoids a stop. The contrast is regressed on the lifespan contrast through the origin,
per gene and over the concatenated 13. `mitoage longevity rates`, into `rates.tsv` and `rate_contrasts.tsv`.
**Control.** Four normalisations, because the choice is what moves results in the published record: the raw
difference, the difference per million years of the cherry's depth, the dN/dS ratio, and the raw difference
with the body-mass contrast in the model. A sign test on the same pairs asks the question directly. Pairs
whose dS exceeds 1 are flagged saturated and every test is reported with and without them.
**Species.** H1's default dataset: 1,369 species with a tip in the dated tree, giving 339 cherries;
dS > 1 in 24.2% of the concatenated pairs.
**Result.** **Nothing survives on the concatenated genes, under any normalisation, in any class.** The
closest are mammals with body mass in the model (slope +0.113 per unit log10 lifespan, p = 0.021, q = 0.15,
115 pairs) and birds per million years (p = 0.073, q = 0.26, 95 pairs). Four of 655 tests pass q < 0.05, all
single genes, and their signs disagree: ND6 across all species (-0.219, q = 0.0076) and avian CYTB per
million years (-0.021, q = 0.011) go one way, mammalian ND5 (+0.220, q = 0.010) the other, and mammalian ND2
on dN (-0.017, q = 0.039) is a fourth direction. Four of 655 at a 5% false discovery rate is what the
correction is designed to allow.
**Reading.** In these data lifespan does not predict the mitochondrial substitution rate, and that answer is
the same under all four normalisations. This does not refute the bivalve and fish reports, which are within
clades this build barely covers; it says the effect is not general across vertebrates.
**Limit.** A cherry gives one contrast, so the test uses 339 of the 1,369 species. Nei-Gojobori counting is
appropriate for close pairs and strained at the divergences a quarter of these cherries reach, which is why
the saturated flag exists rather than a silent filter.

## H8. mtDNA motifs, repeats and the deletion contact zones follow lifespan

**Hypothesis.** Non-B DNA motif counts per mitogenome were proposed as longevity features by the MitoAge
group itself (Toren et al. 2021, Mech Ageing Dev, doi:10.1016/j.mad.2021.111429), repeats have been reported
to track lifespan (Yang, Seluanov & Gorbunova 2013), and the repeats that flank mitochondrial deletions sit
in two defined zones of the genome (Persson et al. 2023, BMC Biol, doi:10.1186/s12915-023-01606-1).
**Test.** The features the site's pipeline publishes in `mtdna_structure.parquet` - G-quadruplex motifs on
each strand, homopurine and homopyrimidine tracts, homopolymer runs, di/tri/tetranucleotide tandem repeats,
direct, inverted and mirror repeats, and the repeat pairs bridging the ATP8-COX3 and ND5-CYTB spans - against
log10 maximum lifespan, in H1's model unchanged: phylogenetic regression on the dated tree with Pagel's
lambda, body mass and fourfold composition in it. Features are standardised, so a slope is per standard
deviation. `mitoage longevity motif-pgls`, into `motif_pgls.tsv`.
**Control.** Every test is run a second time on records whose sequencing technology includes long reads,
since mitoVGP and MitoHiFi both report that short-read reference mitogenomes misrepresent exactly these
features.
**Result.** 132 tests over four classes on the full build; **none passes a 5% false discovery rate**
(smallest q = 0.16, smallest p = 0.005). The strongest raw correlation in the set is the one the
literature reports: perfect inverted repeats against lifespan in 604 mammals, Spearman r = -0.399
(p = 2 x 10^-24), and over the major arc r = -0.334 in 530 (p = 3 x 10^-15). With body mass, fourfold
composition and Pagel's lambda on the dated tree, both are gone (p = 0.67 and p = 0.45). Repeat pairs
bridging the two contact zones behave the same way: r = -0.181 raw (p = 8 x 10^-6, 602 mammals),
p = 0.03 and q = 0.56 after the controls.
**What this replaced, twice.** An exploratory Python run over 2,311 species, with tandem-repeat counts
that did not reject units built from a shorter period, reported mammalian G-quadruplexes at q = 0.048
over 601 species. Rerun on the database's own features while they still covered only 922 species, that
result was gone (q = 0.66) and a reptile G-quadruplex test passed instead (q = 0.027). On the full
build that one is gone too (q = 0.38). Three runs, three different survivors, and none of them
survives the next run: the screen is reporting noise, and this entry reports that rather than any of
the three.
**Limit, and it is the important one.** **The control could not be run.** No record in the build states
a sequencing technology, so the long-read subset is empty and the mitoVGP caveat stays open: every
repeat, motif and contact-zone number above is computed on records of unknown assembly type.
