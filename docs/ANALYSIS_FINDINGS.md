# Analysis findings

What the research arms of MitoAge found on build 2, as of 2026-11-15: longevity in the alignments of the
mitochondrial proteins, the peptides encoded inside mtDNA, the pairing of mitochondrial proteins with
their nuclear partners (mitoport), the substitution rates of the 13 proteins, and the mtDNA motif, repeat
and deletion-contact-zone features. Results that did not hold, and one mistake, are kept next to those that
did. Nothing here is peer reviewed and nothing of it is on the site.

The code is in [dna-seq/mitoage-pipelines](https://github.com/dna-seq/mitoage-pipelines); the commands named
below (`mitoage ...`) are that repository's, and this text is kept the same as its `docs/HYPOTHESES.md`. The
result tables are the Hugging Face dataset
[longevity-genie/mitoage-pipelines](https://huggingface.co/datasets/longevity-genie/mitoage-pipelines); the
prepared inputs are `mitoage-nuclear-partners`, `mitoage-embeddings` and `mitoage-aligner-variants` there.

**First run elsewhere**: the residue-level part of H5, H9, H10 and the Coevol run in H3 were first run by
another agent (Claude Science) on the cluster host `haumea` on 2026-11-14 and 15. Its scripts are now commands
of `dna-seq/mitoage-pipelines` (commit f2006a9), and rerunning them reproduces the published tables, as
each entry says; that repository's README lists what was and was not rerun. The tables of the first run are
kept in `docs/analyses/cluster-2026-11-15/`, with the cluster paths of the original scripts and logs.

**Not done**: the complexes section of the site with nuclear and mitochondrial subunits side by side (RM17);
the mito-nuclear pairing against lifespan for any complex but IV, and for anything other than its contact
residues; the long-read-only replication of H8, because no record in the build states its sequencing
technology (RM18).

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
- Solved structures of the human respiratory complexes from RCSB, each file's SHA-256 recorded.
  `mitoage download pdb`.

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
**Provisional, not to be quoted: Coevol** (lifespan as a continuous trait on every branch, on the dated
tree; `mitoage longevity coevol-prep`, `longevity coevol --chain 1` and `--chain 2`, `longevity coevol-read`).
First run on the cluster on 2026-11-14 and 15 by another agent: two chains of 106 mammals (one per family),
1,100 cycles each, read after a burn-in of 200. The inputs `coevol-prep` writes are byte-identical to that
run's; the chains themselves were not rerun. They had not mixed when these numbers were read (tracecomp:
effective sample size 7 for dN/dS and 15 for the likelihood, relative difference between the chains 0.52 and
0.79; above 100 and small are needed before any of this is quoted), and with that caveat: dS against longevity −0.52 and −0.49 (posterior probability of a positive correlation 0 in
both chains), dN/dS against longevity +0.45 and +0.44 (0.99); as partial correlations, given the other three
variables (body mass among them), dN/dS against longevity is +0.28 and +0.32 (0.88 and 0.91) and dS against
longevity −0.13 and −0.10 (0.07 and 0.14), so the raw dS association went with body mass. The runs need to be
resumed to convergence; until then the result for lifespan as a continuous trait is not assessed.
**Open.** The RELAX runs above used the gene-built tree for their species tree; `relax-prep` now writes the
dated one, and the runs have not been repeated on it.

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
and serves as the method's positive control. Lifespan: H9.
**Residue level, complex IV only** (`mitoage download pdb 5Z62`, `mitoport contacts`, `mitoport burial`,
`mitoport iface-align`, `mitoport iface`; into `sites.tsv` and `coupling.tsv`). Every
residue of COX1, COX2 and COX3 in the human structure 5Z62 was mapped to its column of the MitoAge alignment;
the three chains match MitoAge's human sequences at identity 1.000. 298 residues touch a nuclear subunit
(4.5 Å heavy-atom cutoff), and each was matched to a non-contact residue of the same gene by its accessibility
in the isolated chain. Contact residues are exposed residues (median relative accessibility 0.41 in the
isolated chain, against 0.05 for the residues that are neither contact nor control) and are less conserved
than their matched controls (median identity to human 0.922 against 0.971, Mann-Whitney p = 1.5e-05). Column
occupancy over the 2,174 species with an alignment, a tip and a usable lifespan has median 1.000; 290 of the
298 contact columns are at 0.99 or above, the lowest (COX1 position 2) at 0.46. Then, per nuclear protein, the
correlation over pairs of mammals between its distances and the mitochondrial COX distances, patristic
distance partialled out, with two distances (differing alignment columns; ESM-2 650M per-residue embeddings
averaged over the column set); 61 proteins, 87 to 182 mammals each (166 to 181 for complex IV's subunits).
**The group contrast reproduces**: complex IV's eleven nuclear subunits +0.58 (sequence) and +0.42 (ESM)
against +0.03 and +0.05 for 29 cytosolic controls (p = 7.2e-05 and 1.1e-04); complex III's nine +0.38
(sequence, p = 0.0011); complex II, which has no mitochondrial subunit, +0.05 (p = 0.94); matrix enzymes
+0.03 (p = 0.56). **The interface prediction fails**: on the mitochondrial side, contact residues couple more
than their burial-matched controls by +0.049 for complex IV against +0.016 for the controls (sequence,
p = 0.43; ESM +0.002, p = 0.37); on the nuclear side, interface columns do no better than the rest with the
sequence distance (−0.022, p = 0.72). With the ESM distance the nuclear interface columns of complex IV do
couple more than its other columns (+0.051 against +0.004, p = 0.0096, one of many contrasts and uncorrected),
so the two distances disagree on the nuclear side and this is not assessed further. **Reading.** The coupling
is a property of whole proteins that share a complex with mtDNA products, not of the residues that touch: it
is no evidence of compensation at contacts. Complexes I, III and V have no contact map yet, so this is said
of complex IV only. **Reproduction.** First run on the cluster on 2026-11-14 by another agent; rerun from this
code on 2026-11-15: the contact map and `sites.tsv` are byte-identical, and `coupling.tsv` is identical when
read on that run's nuclear alignments. On freshly made alignments (MAFFT with two threads is not repeatable)
60 of 62 are identical and one protein's sequence correlations move (UQCRQ, +0.565 to +0.572), which changes
no group median. The `esm_` columns read the per-residue ESM-2 embeddings (`mitoage download prepared
--topic residues`).
**Traps met.** IQ-TREE re-places identical sequences unless told `--keep-ident`, which silently changes the
tree; NCBI's ortholog sets for CYC1, SDHC and SDHD held 21 to 48 sequences of another gene or a broken
model, filtered by identity to human; a test of nuclear rate against overall mitochondrial rate with one
shared denominator is invalid and is not reported.
**Open.** Contact maps for complexes I, III and V; the pairing against lifespan beyond complex IV's contact
residues.

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

## H9. Mismatch at complex IV's mito-nuclear contacts follows lifespan (mitoport)

**Hypothesis.** The port project's question narrowed to mitochondria: species whose COX1-3 residues at the
contacts with nuclear subunits differ more from the consensus than burial-matched non-contact residues do
have a different maximum lifespan.
**Test.** `mitoage mitoport iface`, into `lifespan.tsv` (with each slope's standard error and 95% interval);
first run on the cluster on 2026-11-14 by another agent, and the rerun from this code gives the same table.
Per species, the share of H5's 298 contact columns where its residue differs from the most common residue
of the column among the species of the set (gaps left out), the same at their 298 matched controls, and the
difference, each standardised; phylogenetic regression of log10 maximum lifespan on it, log10 adult body mass
in the model, Pagel's lambda estimated on the null model, the build's dated tree.
**Control.** The burial-matched non-contact residues, as their own regression and as the subtracted term.
**Result.** All species (1,373, lambda 0.96): slope of contact minus control −0.024 log10 years per standard
deviation, 95% interval [−0.050, +0.002], which bounds any effect to at most about an 11% shorter or a 0.5%
longer maximum lifespan per standard deviation of mismatch. Mammals (604): −0.006, [−0.028, +0.017]. The 176
species that also have nuclear partners: −0.007, [−0.049, +0.035]. Contact and control mismatch alone give
intervals that include zero in every set as well.
**Reading.** A bounded null: in these species an association of contact mismatch with lifespan larger than
about a tenth of maximum lifespan per standard deviation is excluded, and nothing smaller is claimed. Like H2, H7
and H8, a lifespan question whose answer here is no detectable effect. The
mitoport plan's stop rule is reached for its contact-residue branch.
**Limits.** Complex IV only, with one human structure for every species; mismatch counted against the consensus
residue, not against each species' own nuclear partner (the partners exist for 176 of these species); no result
of the cybrid calibration that RM11 proposed first is recorded in this repository.

## H10. Aligning by structure changes the columns of the mitochondrial proteins (RM13)

**Hypothesis.** The 13 proteins are membrane proteins of a few families of folds, and sequence aligners may
misplace columns that structure would put elsewhere.
**Test.** `mitoage download pdb 5XTD 5Z62 8H9S 5XTE 5XTH 5XTI 6ZQN 7AJD`, `structure within`, `structure
fold` (GPU), `structure msa`; into `within_species.tsv`, `chains.tsv`, `plddt.tsv` and `structural_msa.tsv`.
First run on the cluster on 2026-11-14 and 15 by another agent; rerun from this code, `within` and `msa` (on
that run's structures) give the same tables, timings aside; the folding was not rerun, and its 806 structures
are published (`mitoage download prepared --topic structures`). First, the 13 proteins from solved human structures (ND1-6 and ND4L from
5XTD, COX1-3 from 5Z62, CYTB from 5XTE, ATP6 and ATP8 from 8H9S; identity to MitoAge's human sequences 0.979
to 1.000), superimposed all against all with US-align. Then predicted structures of the 13 proteins in 62
mammals (806 structures, ESMFold2, checkpoint `biohub/ESMFold2-Fast`, one sample), aligned by FoldMason and
compared with MAFFT L-INS-i on the same sequences: the share of residue pairs placed in one column by both,
over 500 species pairs per gene, overall and in the conserved core.
**Result, folds.** Of the 78 pairs of mitochondrial proteins three exceed a TM-score of 0.5 normalised by the
longer chain: ND4-ND5 0.69, ND2-ND4 0.67, ND2-ND5 0.52 (340 to 447 aligned residues, RMSD 2.5 to 2.8 Å), the
antiporter-like triad of complex I; the next is 0.41 (COX1-ND4). The rest are unrelated folds. Scores
normalised by the shorter chain run high for short subunits and are not used.
**Result, alignments.** Median agreement 0.9997 over the 13 genes and 1.000 in the core; the lowest are ND6
(0.970; core 0.996) and ND5 (0.982), and no core is below 0.993 (ATP6). Mean pLDDT 84.8: 79 to 97 for ten
proteins, 56 to 62 for ND3, ND4L and ATP8. Disagreement does not follow model confidence (r = −0.03 across
genes).
**Cost.** Aligning is trivial (18 s FoldMason, 9 s MAFFT for the 13 genes); folding took 11,949 s for 806
structures on one A100 (40 GB), 14.8 s per structure, which extrapolates to about 120 GPU-hours on that card
for the 2,290 species of the build with all 13 proteins (a rough figure: proteins of other phyla differ in
length).
**Reading.** At the divergence of mammals structure does not move the columns: the sequence alignments stand,
and H0's soft genes (ND6, ND5) are also where structure and sequence differ most, by little.
**Limits.** Mammals only (62 species); one prediction per sequence; agreement between two methods is not
correctness. Distant phyla, where sequence aligners are more likely to err, are not assessed; at the same rate,
20 species across phyla would take about one GPU-hour.

## H16. The published cybrids, simulated: does mismatch at the mito-nuclear contacts predict which complex fails?

**Question.** H5, H9 and H14 ask whether the residues where mtDNA-encoded subunits touch nuclear ones carry
anything beyond the whole protein, using sequences alone. Xenomitochondrial cybrids measure it: a donor species'
mtDNA in cells of a host species, so every nuclear subunit is the host's and every mtDNA-encoded one the donor's.
Before any of our interface scores is read as incompatibility, it should order the published cybrids as their
measured complex activities do. This is RM11's calibration, first proposed and not run until now.
**Data.** `src/mitoage_pipelines/mitoport/cybrid_measurements.tsv` (in dna-seq/mitoage-pipelines), transcribed by hand with the figure or table of
each value: human cells with chimpanzee, bonobo and gorilla mtDNA (doi 10.1074/jbc.273.23.14210); mouse cells with
*Mus spretus* and rat mtDNA (10.1074/jbc.M004070200), rat again from a second laboratory (10.1074/jbc.M004053200),
and *M. caroli*, *M. terricolor* (the papers' *Mus dunni* line), *M. pahari* and *Otomys irroratus*
(10.1093/molbev/msg132); donors that gave no respiring cybrid: orangutan in human cells (10.1073/pnas.94.17.9131;
the paper names no species, so both *Pongo* species are scored) and two hamsters in mouse cells
(10.1074/jbc.M004070200). In all, 30 measured (host, donor, complex) points: 9 reduced, 20 not, and one where the
two laboratories disagree (rat, complex III: 37% of control in one, not reduced in the other), which is left out.
Only 13 points have a stated value; the rest are given as not significantly different, without a number, and are
used only as not reduced. Complex III in the murid papers is a linked II+III assay, which shows only severe defects.
**Method.** `mitoport cybrid`, fixed in its docstring before the first run. Contact maps of the four human complexes
(I 5XTD, III 5XTE, IV 5Z62, V 8H9S) with H14's chain table and definition (4.5 A heavy atoms, the reference chain of
each gene, complex III's other cytochrome b a mitochondrial partner): 621, 104, 298 and 129 contact positions, the
same sets `mitoport contacts` finds (tested). Host and donor proteins from RefSeq at fixed versions, placed on human
positions by a global alignment; the cytochrome b the 2003 paper sequenced from its own cell lines replaces RefSeq's
for *M. spretus*, *M. terricolor* and *Otomys* (identical for the first two, 2 residues apart for *Otomys*). Scores per
(host, donor, complex): differing contact positions (`d_contact`), their share (`f_contact`), those with a negative
BLOSUM62 score, and the same counts at the resolved non-contact positions and over every position (`d_all`, `f_all`:
divergence, the baseline any interface score has to beat). Tests: T1 Spearman of the stated activities against each
score; T2 the area under the ROC curve for reduced against not reduced; T3 whether the highest-scoring complex of a
pair is its most reduced one; T4 whether donors that gave no cybrid score above every donor that did, in the same host.
No significance is claimed anywhere: the points are few and not independent (one host, one laboratory per series).
**Result** (dna-seq/mitoage-pipelines `results/h16/summary.tsv` and `calibration.tsv`, commit 0b1c5e8).
- T1, 13 stated values: the contact count orders them worse than divergence (Spearman −0.20 against −0.36 for
  `d_all`; as shares −0.46 against −0.59).
- T2, 9 reduced against 20 not: `d_contact` 0.80, `d_all` 0.74, non-contact positions 0.73; as shares 0.68, 0.61 and
  0.54. The edge of the contact count over divergence is about 10 of the 180 reduced-against-not orderings.
- T3, six pairs with a reduced complex: the raw counts, contact or not, always name complex I, the largest, and so are
  right for the three apes and the rat and wrong for *M. pahari* (complex IV reduced) and *Otomys* (complex III at 2%);
  shares do worse (2 of 6 for `f_contact`, 1 of 6 for `f_all`). No score here says which complex fails.
- T4: both orangutans and both hamsters score above every donor that respired, with the contact count and with
  divergence alike.
- Exploratory, added after the above had been read (T2b, T2 within one complex): complex IV 0.86 for the contact count
  against 0.72 for divergence (3 reduced, 6 not); complex III 0.86 against 0.71 (one reduced); complex I 0.60 against
  0.55. Complex I is where hosts differ: the apes' complex I is reduced with 42 to 53 differing contacts, while
  *M. pahari*'s is normal with 100.
**Reading.** The cybrids confirm what divergence alone predicts: defects grow with the distance between host and
donor, and the donors that fail are the most distant. A count of differing contact residues adds little to it:
slightly better at telling reduced from normal complexes, worse at ordering the measured activities, and unable to
say which complex fails in a given pair. That agrees with H5, H9 and H14 (the coupling belongs to whole proteins),
and it means the interface mismatch scores used so far cannot be read as a measure of incompatibility. It neither
confirms nor refutes an interface mechanism: a count weighs every substitution alike, while the murid paper points
to a few cytochrome b residues near the Rieske protein's path. What could test that is an energy at the threaded
interface (FoldX or Rosetta on the chimeric complexes), which is heavier and belongs on haumea.
**Limits.** RefSeq individuals stand in for the donor cell lines except for cytochrome b. The mouse host is scored
on human structures through its own sequences, not on a mouse structure. Activities are percentages of each paper's
control, by different assays and normalisations. Failure to form a cybrid can have causes other than the respiratory
chain (replication, translation). T2b was added after the first run.

## H17. The cybrids again, with scores that weigh substitutions: co-evolved pairs and ESM-2 (H16's open item)

**Question.** H16's count of differing contact residues did about as well as divergence and could not say which
complex fails. A count weighs every substitution alike. Do scores that weigh them order the cybrids better: one that
asks whether the chimera breaks residue pairs vertebrates keep together, and a protein language model's view of the
donor's residues in the host's proteins? Molecular dynamics and interface energies are the heavier alternative; these
two are cheap and open, and are tried first.
**Fixed before any score was computed.** This entry was committed with the code, before the jobs ran. The measured
table, the points and the readouts T1 to T4 (and T2b) are H16's, unchanged (`mitoport cybrid-readout`).
- *Co-evolution* (`mitoport cybrid-coev`; the definitions are in the docstring of `mitoport/cybrid_coev.py`). The contact
  pairs and their control pairs are H12's and H14's, for the four complexes. Over the vertebrates with both proteins,
  each pair of columns gets the pointwise mutual information of a mitochondrial with a nuclear residue (sequences
  weighted at 80% identity, pseudocount 0.05, host and donor left out). A pair where donor and host differ loses
  PMI(host mt, host nuclear) − PMI(donor mt, host nuclear). The score, `coev_excess`, is the sum over contact pairs
  minus the sum over control pairs, and `coev_excess_mean` is that per pair scored. Sensitivities that enter no
  reading: pseudocount 0.5, and the host's whole order left out of the counts.
- *ESM-2 650M* (`mitoport cybrid-esm`; `mitoport/cybrid_esm.py`). Masked marginals in the host's protein: `esm_contact`
  (and its mean per contact residue) is how unlikely the model finds the donor's residues at the contacts, alone;
  `esm_partner_excess` is what placing the host's nuclear partner beside the protein adds at the contact residues,
  minus the same at their control residues.
- *Baselines*, on the same points: H16's `d_contact`, `d_all` and `f_all`.
- *Reading.* A score adds to divergence if, against `d_all`, it does all three: a higher area in T2 by at least 0.10
  (`d_all` has 0.74), a more negative Spearman in T1 (`d_all` has −0.36), and the most reduced complex named in at
  least 5 of the 6 pairs of T3, which requires *M. pahari* (complex IV) or *Otomys* (complex III) to be right (the raw
  counts get 4 by always naming complex I). Two of three is reported as partial and claimed as nothing. If no score
  does, the answer is that these sequence-based scores do not find the cybrids' defects, and an interface energy or
  molecular dynamics is what remains.
- *Known weaknesses, said in advance.* The points are few and not independent. The pairs' statistics come from 267
  to 415 vertebrates per subunit, far fewer effective sequences, so pair frequencies are coarse. The contact map is
  the human one, used for the mouse host through the alignment. ESM-2 was not trained on complexes; a partner joined
  by a glycine linker is a known trick with a weak signal, and pairs over 1,022 residues are not assessed. `esm_contact`
  alone sees no nuclear subunit: if it works, it measures how unusual the donor's protein is, not a mismatch.
**Test.** `slurm/h17-cybrid.sbatch` (CPU: the contact maps, the co-evolution score, the tests and the breaks of each
guard, a rerun check) and `slurm/h17-cybrid-esm.sbatch` (GPU: the ESM-2 scores, then the readout), on haumea, on the
inputs of H14's job (build 0f4e970, its vertebrate partner alignments).
**Result** (haumea jobs 6493605 and 6493606, run from 329d9a6; dna-seq/mitoage-pipelines `results/h17/`, commit ffdb2d6). No score meets the rule; none meets
two of its three parts.

| score | T1 Spearman (13) | T2 area (9 against 20) | T3 most reduced complex named (of 6) |
| --- | --- | --- | --- |
| `d_all` (divergence, the baseline) | −0.36 | 0.74 | 4 |
| `coev_excess` | −0.06 | 0.73 | 4 |
| `coev_excess_mean` | −0.03 | 0.67 | 3 |
| `esm_contact` | +0.33 | 0.33 | 2 |
| `esm_contact_mean` | +0.41 | 0.33 | 1 |
| `esm_partner_excess` | −0.12 | 0.58 | 4 |

- *Co-evolution.* `coev_excess` names *M. pahari*'s complex IV, which no count does, but names complex IV for the rat
  and for *Otomys* too, where complexes I and III are the most reduced. Its sensitivities fall to chance in T2 (0.51
  with the pseudocount 0.5, 0.54 with the host's order left out), so what it has rests on the host's relatives. The
  pairs' statistics are thin where the proteins are conserved: at 80% identity the 418 species of complex IV count as
  3.3 effective sequences, complex III's 420 as 16.8 (complex I 74.5, complex V 58.9).
- *ESM-2 alone* goes the wrong way: complexes whose donor residues the model finds less likely are the less reduced
  ones (T2 0.33, T1 positive).
- *ESM-2 with the partner.* `esm_partner_excess` names *Otomys*' complex III, the 2% of control that no other score
  finds, and the three apes' complex I; it misses the rat and *M. pahari*, and across all points separates reduced from
  normal complexes poorly (0.58).
- *T4*, donors that gave no cybrid: both hamsters score above every donor that respired with `coev_excess`,
  `esm_contact` and `esm_partner_excess`; of the two orangutans only *P. pygmaeus* does, and not with `esm_contact`.
  Divergence places all four.
**Reading.** By the rule fixed in advance, these sequence-based scores do not find the cybrids' defects: neither the
co-evolved pairs nor ESM-2 orders the measured activities or separates reduced from normal complexes better than
divergence. Two single hits are not claims and are named only as what a later test could ask again: the partner
reading of ESM-2 at *Otomys*' complex III, and the co-evolution score at *M. pahari*'s complex IV. What remains for
the interface question is an energy on the threaded chimeric complexes, or molecular dynamics at a few sites.
**Limits.** Those said in advance, and: the 80% identity weighting, standard for families of proteins, leaves almost
no effective sequences for the conserved COX proteins, so complex IV's co-evolution score is close to unweighted
noise; the library did not report the checkpoint's commit; one partner pair of complex I exceeds the model's length in
each host and was not assessed.
