# Roadmap

Open work only, in order. Each item is a section `## RMn — name` with a line saying its state and its
owner. A done item leaves this file; `docs/CHANGELOG.md` says what landed.

## RM2 — Bring the explorer's payload under its page-weight target

**State:** blocked: desk #44 (if nobody answers, the file stays one piece) · **Owner:** lead

`/data/explorer.json` is 2.7 MB with build 2, against 1.5 MB (open questions, item 9); the check in
`pipeline/validate.ts` counts the unpacked bytes. Measured on 2026-11-17: the site serves it gzip-compressed and a
browser downloads 0.8 MB. Of the 2.7 MB, 2.35 MB are the values of 165 features, about 14 to 18 kB each. The question
on the desk is what the target limits: the download (met; change the check, close this) or the unpacked file (split
the values by region, on the site's side, as the extended features and the per-gene codon tables already are).

## RM4 — The build 2 defaults, put to the maintainer

**State:** blocked: desk #49 (four calls that change results; if nobody answers, the defaults stay) and desk #43 (order and family, RM24) · **Owner:** lead

`docs/BUILD2_OPEN_QUESTIONS.md` lists 20 calls made without confirmation. Asked in `#mitoage>decisions`,
the ones that change results first: order and family not harmonised between AnAge and NCBI (e), the ids
of new species (1), a third correlation dataset without the quality filter (3), the two rows whose record
now resolves to another species (c), a nullable maximum lifespan (b). Each answer goes to
`docs/DECISIONS.md`; a changed default becomes an item.

## RM6 — The upstream sources, checked weekly

**State:** waits until 2026-11-20: the next check · **Owner:** lead

The priming's weekly look for a release newer than each pin; the dates and findings are in
`docs/seats/LEAD_NOTES.md`. A newer release becomes its own item.

## RM8 — Detect possible duplicate species

**State:** unattended · **Owner:** lead

The three pairs flagged in build 2 come from a hand audit (`POSSIBLE_DUPLICATES`, open questions, item h).
Done on 2026-11-17: the rule by sequence, `bun run duplicates`, which lists 12 pairs of one genus with nearly
identical protein genes (changelog; `docs/analyses/possible-duplicates/`). It does not find the three hand
pairs, whose sequences differ. Left: the rule by names (two names one taxonomy treats as synonyms, in NCBI or
FishBase), inside `bun run data`, reporting into the review list and never merging; and what the build does
with the 12 pairs by sequence (a review flag at most), which is the maintainer's to say.

## RM9 — A DOI for each build

**State:** after RM4 · **Owner:** lead

`plans/DATA_BUILD2_DECISIONS.md`, section 7: each build is intended for a Zenodo DOI. The seat prepares
the deposit's files and text; publishing is outside its grant.

## RM12 — Longevity in the alignments: sites, selection pressure, convergence

**State:** waits until 2026-11-18: step 5 is H26 of `dna-seq/mitoage-pipelines`, long-lived for body mass as one more trait in the design of H21 (mammals and birds). Its pair test ran on 2026-11-17: not detected in birds (41 pairs), not assessed in mammals (6 unsaturated pairs). Its RELAX runs (46 tasks of 4 CPUs) are held while the cluster is at its CPU cap, looked at again that day. Steps 1 to 4 and lifespan as a continuous trait ran (H0 to H3 and H7 there) · **Owner:** lead

The maintainer, 2026-11-13: "As we have MSA can you plan an analysis to reveal longevity insights? I also
assume we can apply sone philogeny methods to check for longevity related evolutionary pressure and to check
for convergent evolution of unrelated species selected for longevity". The plan was posted in
`#mitoalignments>general chat` the same day; he has not answered it yet, and its order is the default.
Python reads the data with polars and polars-bio (his word: "For python default library to read must be
polarsbio"), from the Hugging Face dataset (D6).

Fixed before any result is seen: the tree is the dated species tree of the build, never one made from these
genes; lifespan is log maximum lifespan and its residual on body mass, records of high or acceptable quality
only; mammals and birds first, then fishes and reptiles, all species together only as a last look; a column
rule (filled share, agreement between aligners) set before testing; body mass, base composition and strand
bias in every model, body temperature for cold-blooded classes; the 13 genes are one linked molecule, so
gene-level results are not independent tests.

1. The aligner (the maintainer asked whether newer tools do better; no Rust one was found): the 13 proteins
   with MAFFT's fast mode (the pin), a more accurate MAFFT mode, FAMSA2 and Muscle5; how many columns agree
   and where they do not, reported in the channel; the pin changes only on a clear difference.
2. Positive controls: cysteine, methionine and threonine content against lifespan with phylogenetic
   regression must come out as published (Jobson 2010, Aledo 2012 for the nucleotide-bias control). If they
   do not, stop: the method is wrong.
3. Site by site: each column against lifespan with the tree and body mass in the model, corrected for the
   number of columns; hits compared with the positions of Mariadassou & Pellay 2014
   (doi:10.1016/j.exger.2014.03.009), whose full text is needed.
4. Selection pressure, on the codon alignments, per class: Coevol (dN/dS along the tree jointly with
   lifespan and body mass; a sample of a few hundred species), HyPhy RELAX (relaxed or intensified selection
   on long-lived branches), aBSREL or BUSTED-PH (episodes of positive selection tied to the trait).
5. Convergence: lineages that became long-lived independently, picked by lifespan relative to body mass,
   each paired with a short-lived relative; CSUBST (convergent codon substitutions against chance), PCOC
   (sites whose amino-acid preference shifts the same way), RERconverge (gene-level, weak with 13 linked
   genes).
6. Where the hits sit on the solved structures of complexes I, III, IV and V (joins RM11).

Done so far (2026-11-13 and 14, reported in `#mitoalignments`): steps 1 and 2; step 3 for mammals and
birds. Substitution rates, which the survey of the literature after the MitoAge paper raised as its own
question, are answered separately in H7 (`mitoage longevity rates`): on 339 sister pairs of the dated tree
lifespan does not predict the rate under any of four normalisations. Step 3 was first run on a tree built from the 13 proteins and on every lifespan record, against the
rules above, and gave cytochrome b 43 as its one site; rerun on the dated tree with the quality filter, that
site does not pass (q = 0.29), COX1 419 sits at the threshold in its place, and the summary is that no
single residue is robustly associated with lifespan. Step 4 (RELAX) gave two genes in one draw of species
and none in a second. Lifespan as a continuous trait (Coevol, 106 mammals, two chains) ran on the cluster
but had not converged (effective sample size 7 for dN/dS): provisional numbers in `docs/ANALYSIS_FINDINGS.md`
H3, not to be quoted until the chains are resumed to an effective sample size above 100. Next: that, and step 5.

Each tool's current version and limits are checked before use: the method names above are from memory of the
literature. Reported in `#mitoalignments`; nothing goes on the site before the maintainer has seen it.

## RM16 — Peptides encoded inside mtDNA: kept across species, and against lifespan

**State:** waits until 2026-11-18: the cluster is at its CPU cap (the maintainer, 2026-11-16: "so far we are hitting cpu capp on the cluster"). The blind scan (step 4) is left. The published peptides were run across the whole build against nulls of the host gene (H15 in `dna-seq/mitoage-pipelines`) · **Owner:** lead

The maintainer: "there was a recent research on many peptides discovered at mtDNA not known until recently,
can we investigate them?" The published ones are small reading frames inside the rRNA genes (humanin,
SHLP1 to 6, MOTS-c), inside other frames of the protein genes (MTALTND4, MTALTCO1, MENTSH) and in the
D-loop (MASL); nearly all the evidence is from human. With the alignments this repository has four
questions, in order:

1. Is each published frame there in each species: a start, no early stop, the length; read with the
   species' own mitochondrial code and with the standard code.
2. Is it kept beyond what its host gene's conservation gives for free: against windows of the same length
   in the same gene and frame, then against the host's synonymous codons shuffled.
3. Frame kept or lost, and its sequence, against maximum lifespan, with the tree taken into account (the
   same controls as RM12).
4. A blind scan: every frame of 20 codons or more, six frames, all species, ranked by how widely it is
   kept beyond the null.

A kept frame is not a translated peptide: the data has no ribosome profiling and no mass spectrometry, and
nuclear copies (humanin has them) are out of its sight. The code lives in `dna-seq/mitoage-pipelines`.
Reported in `#mitoage`; nothing goes on the site before the maintainer has seen it.

## RM11 — mitoport: mitochondrial and nuclear partners against lifespan

**State:** waits until 2026-11-18: the cluster is at its CPU cap and the maintainer said on 2026-11-16 to wait ("so far we are hitting cpu capp on the cluster"). Left are the per-residue embeddings at contact positions. Ran, all in `dna-seq/mitoage-pipelines`: rate covariation (H5), embeddings (H6), contact mismatch against lifespan (H9, a bounded null), complexes I, III and V (H14: the coupling belongs to whole proteins, not to the touching residues), the published cybrids (H16) · **Owner:** lead

Started 2026-11-13, reported in `#mitoage>mitoport`: nuclear subunits from NCBI's ortholog sets (184 of 627
mammals have them); rate covariation on 62 mammals shows complex IV's nuclear subunits following the
mitochondrial COX genes and no others (the positive control); complex III shows nothing. Next: more
species by pairwise pruning, contact against non-contact residues, then lifespan; embeddings asked of the
kron seat. The maintainer widened the idea the same day: "paired selection between mitochondria proteins
and their nuclear interaction partners ... both with evolutionary pressure methods and esm coembedding
like approaches".

The maintainer's idea (2026-11-13): borrow from `longevity-genie/longevity-port-pipelines`, narrowed to
mitochondria, "to see how interactions between mitgenes and nuclear genes differ in organisms to search for
longevity connections". Proposed there: one complex first (cytochrome c oxidase), contact residues from a
solved structure, the species of build 2 that also have nuclear orthologs, co-change at contacts against
lifespan on the dated tree with buried non-contact positions as the control, and a stop rule. The maintainer
added that the port project's null need not hold for mitochondria and that cybrids give measured
compatibility; so the first step became a calibration: for the published cybrid series (apes on a human
nucleus, rodents on a mouse nucleus, about 12 pairs with activity per complex; a helper's literature table
is in `#mitoage>mitoport`, unchecked), does a contact-residue mismatch score per complex order the pairs as
the measurements do. The port
project's own result is a caution: its interface screen found no longevity signal. Open: nuclear orthologs
are a new data source (the maintainer's), and where the code lives (a separate repository is the default).

Run on the cluster on 2026-11-14 and 15 by another agent (Claude Science), then ported to
`dna-seq/mitoage-pipelines` as `mitoport contacts`, `burial`, `iface-align` and `iface`, whose rerun reproduces
it; the first run's tables and the cluster paths are in `docs/analyses/cluster-2026-11-15/`, the numbers in
`docs/ANALYSIS_FINDINGS.md` H5 and H9. Complex IV only: 298 COX1-3 residues of PDB 5Z62 touch a nuclear
subunit. The group contrast reproduces (complex IV's nuclear subunits couple with the COX genes at +0.58
against +0.03 for cytosolic controls), but contact residues do not couple more than burial-matched
non-contact ones (excess +0.049 against +0.016 for the cytosolic controls, p = 0.43), so the coupling is a whole-protein property,
not an interface one. Lifespan on the contact-minus-control mismatch, 1,373 species with body mass: slope
−0.024 log10 years per standard deviation, 95% interval [−0.050, +0.002], a bounded null. **The stop rule is
reached for the contact-residue branch**: it is not pursued further. Still open: contact maps for complexes I,
III and V.

The cybrid calibration ran on 2026-11-15 (`mitoport cybrid`, `docs/ANALYSIS_FINDINGS.md` H16). It covered six
papers, 30 measured (host, donor, complex) points and four donors that gave no cybrid, and the literature table
was rebuilt from the papers rather than taken from the helper's. A count of differing contact residues does about
as well as divergence over whole proteins, and like divergence it cannot say which complex fails in a pair, so the
counts used so far are not a measure of incompatibility. Open: an interface energy on the threaded chimeric
complexes (FoldX or Rosetta), on haumea, scored against the same table.

The cheaper scores were tried first, on 2026-11-16 (H17, fixed in advance; haumea jobs 6493605 and 6493606): the
co-evolved residue pairs a chimera loses at the contacts, and ESM-2's reading of the donor's residues in the host's
proteins, alone and beside the nuclear partner. Neither beats divergence on the cybrid table by the rule set before
the run. The interface energy, or molecular dynamics at a few sites, stays open; FoldX needs an academic licence
that the maintainer registers for at https://foldxsuite.crg.eu/academic-license-info.

## RM17 — A complexes section: mitochondrial and nuclear subunits, compared across species

**State:** blocked: desk #42 (in the top menu or not; if nobody answers, it stays out). The first version is live since 2026-11-16 (changelog, D21): the four complexes' subunits and complex IV's contacts residue by residue. Left, each waiting on the maintainer's word after he has seen it: a 3D viewer, the contact maps of complexes I, III and V on the pages, the nuclear subunits' sequences · **Owner:** lead

The maintainer: "can we extend mitoage website with page on interactions with complexes and provide
complexes for all those species in comparative way?" Proposed to him: a page per complex (I, III, IV, V)
with its mitochondrial and nuclear subunits, which species have which, each subunit's alignment in the
viewer; the solved structure in a 3D viewer, coloured by conservation or by one species' differences,
contacts between mitochondrial and nuclear subunits marked; per species, contact residues that differ,
next to lifespan. Limits said to him: nuclear subunits exist for about 180 of the mammals, not for all
species; one solved structure for every species, no predicted structure per species; nuclear orthologs
and structures are new sources for the pipeline, his decision as with build 2. Source of orthologs,
measured the same day for COX4I1: NCBI covers 183 of our 627 mammals, Ensembl release 116 covers 65 and
says which pairs are one-to-one; proposed: NCBI for breadth, Ensembl as the referee. It depends on RM11's
data.

The per-residue table it needs exists for complex IV only: `docs/analyses/cluster-2026-11-15/SITES.tsv`, every
COX1-3 residue of PDB 5Z62 with its MitoAge alignment column, burial in the complex and alone, its nuclear
contact partners, occupancy and identity to human (`mitoage mitoport burial` in `dna-seq/mitoage-pipelines`
writes it; it is not produced by this repository's pipeline). Complexes
I, III and V have no contact map yet; complex II has no mitochondrial subunit.

Started by D20 (2026-11-16): `/coevolution/` shows mitoage-pipelines' per-protein coevolution tables and each species'
contact-pair discordance at complex IV, with the contact map as a download; a page per complex, the subunits per
species, the alignment of each nuclear subunit and the structure viewer are still to come.

## RM14 — D-loops annotated as a point

**State:** blocked: desk #35 (if nobody answers, nothing changes in the data) · **Owner:** lead

Found reading the live site (RM3): of the 1,976 species with a D-loop annotation, 29 have one of exactly
1 base, 2 of 2 to 9 and 10 of 10 to 99; the rest have a median of 1,051. Each counts as a region today, so
the D-loop's GC content ranges from 0 to 100% in the statistics and these values enter the D-loop
correlations. The rule proposed: under 100 bases counts as not annotated (unknown). A data rule, applied at
the next data build, which runs where the pipeline's inputs are (RM7).

## RM20 — Release mitoage-mcp to npm

**State:** open; the upload and the pin are done (D9), the tag is not · **Owner:** maintainer

Build 2 is on Hugging Face at revision `c525adbff8c12b19981fdada7f1615c2559b7140` with
`mitoage.sqlite`, and `mcp/src/dataset.ts` names that revision and the file's SHA-256, so the server
runs with nothing set. What is left is the release itself: add `NPM_TOKEN` as a repository secret, then
`git tag mcp-v0.1.0 && git push origin mcp-v0.1.0`. The workflow checks that the tag matches the
version and that the revision is a full commit SHA before it publishes. The npm name `mitoage-mcp` was
free on 2026-11-15 and is not reserved. Once it is published, add it to the manuscript's numbered
references beside 40-42, which was left out while the URL would have 404ed.

## RM22 — Calibrated counts, power and a like-for-like comparison with release 1

**State:** open; PGLS done and in Table 3 and S1 (D18, D19); A1 can start from the EURING calibration (b6c6ec6); one question to the maintainer · **Owner:** lead

The v0.3 skeptic's verdict: the counts come from an uncalibrated test, the negative reading has no power
estimate, and the question the paper poses (how much of the loss drift causes) is not answered. The plan is in
`docs/REVIEW_ANALYSES_PLAN.md`:

- **A:** expected chance passes beside every count, a phylogenetic permutation p value and, if the maintainer
  agrees, PGLS over the whole table.
- **B:** power of each step of the funnel by simulation on the tree, and which lost correlations are bounded
  rather than underpowered; the retests' smallest detectable effects set against the published ones.
- **C:** a waterfall from release 1's values to build 2's Table 3 on the 903 shared species, one change per step.

How each outcome will be read is fixed in the plan before anything runs. Which count leads is settled (D16: the t test,
with chance bounds beside every count). PGLS over the whole table runs (D18).
Open there: whether to rerun the rate test with a codon model.

## RM23 — The records the audit questions

**State:** open; one question to the maintainer (reporting to NCBI) · **Owner:** lead

The record audit (mitoage-pipelines H13, run on build 0f4e970; Supplementary Methods S16 and Table S4 of round
v0.3) found records that are probably wrong: near-identical records under different genera (*Echis coloratus* and
*Vipera berus* identical over 11,265 bases; *Tadorna tadorna* a mallard's), a butterfish record that looks like a
characiform's, three vertebrate records deposited reverse-complemented, and genes left unannotated. The build keeps
them as RefSeq deposits them. What is left:

- A per-record flag in the build and on the species pages, naming the audit's finding, so a user can leave a record
  out; nothing is removed by default.
- The GC/AT balance of the three reversed deposits is of the other strand: compute it on the conventional strand
  for vertebrate records the audit calls reversed, with a changelog row each.
- Annotation gaps (CYTB of *Pluvialis fulva*, ND6 of *Phalacrocorax auritus*, both rRNAs of *Crocidura russula*):
  patch them the way the parrot's ND6 was patched, or leave them stated as missing.
- Whether to report the candidates to NCBI (RefSeq's record-feedback route) is the maintainer's call; nothing is
  sent before that.

## RM24 — One taxonomy for a species' order and family

**State:** blocked: desk #43 · **Owner:** lead

39 families (268 of the 2,344 species) are filed under two orders, and ten genera under two families: 30 of
the families are ray-finned fishes (Scombridae under Perciformes and Scombriformes), 7 are mammals (Delphinidae
under Cetacea and Artiodactyla, Soricidae under Soricomorpha and Eulipotyphla), with Crocodylidae and
Strongylocentrotidae. A family's page, an order's page and every per-order number split such a group.

The split follows one line exactly (counted on the committed species table, 2026-11-16): the 922 species kept
from build 1 take their order and family from AnAge, or from build 1 where AnAge has none, and the 1,422 new
species take them from the NCBI lineage (`pipeline/steps/build2.ts`). No family mixes the two within one of
its orders. 44 species have no order and 6 no family, all from NCBI lineages without that rank.

The question on the desk: NCBI's order and family for every species (recommended: the one source that covers
all of them; Cetacea, Soricomorpha and Erinaceomorpha stop being orders and their addresses get redirects), or
the build 1 scheme first within a family, or as it is. Either change is a rerun of `bun run data`, which the cluster can
do since 2026-11-17 (`bun run inputs`).
