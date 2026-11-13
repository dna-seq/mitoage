# Roadmap

Open work only, in order. Each item is a section `## RMn — name` with a line saying its state and its
owner. A done item leaves this file; `docs/CHANGELOG.md` says what landed.

## RM2 — Bring the explorer's payload under its page-weight target

**State:** waits until 2026-11-17: after the first steps of RM12, which the maintainer asked for first · **Owner:** lead

`/data/explorer.json` is 2.7 MB with build 2, against 1.5 MB (open questions, item 9). Split it on the
site's side, as the per-gene codon tables are.

## RM4 — The build 2 defaults, put to the maintainer

**State:** blocked: desk #34 (the five calls that change results; if nobody answers, the defaults stay) · **Owner:** lead

`docs/BUILD2_OPEN_QUESTIONS.md` lists 20 calls made without confirmation. Asked in `#mitoage>decisions`,
the ones that change results first: order and family not harmonised between AnAge and NCBI (e), the ids
of new species (1), a third correlation dataset without the quality filter (3), the two rows whose record
now resolves to another species (c), a nullable maximum lifespan (b). Each answer goes to
`docs/DECISIONS.md`; a changed default becomes an item.

## RM5 — EURING bird longevity values

**State:** waits until 2026-11-20: whether the EURING list can be retrieved · **Owner:** lead

The list was not retrieved for build 2 (the site was in maintenance), so 26 birds take USGS values and
are provisional (open questions, item 10). When the file is there: its parser in `pipeline/sources/euring.ts`
from the real file, the pin, a rebuild.

## RM6 — The upstream sources, checked weekly

**State:** waits until 2026-11-20: the next check · **Owner:** lead

The priming's weekly look for a release newer than each pin; the dates and findings are in
`docs/seats/LEAD_NOTES.md`. A newer release becomes its own item.

## RM7 — The pipeline's inputs on every machine that runs the seat

**State:** blocked: desk #32 (if nobody answers, data rebuilds stay on the laptop) · **Owner:** lead

`bun run data` and one test file (`pipeline/tests/lifespan.test.ts`) need the build 1 CSVs (`data/input/`)
and the pinned downloads (`data/cache/build2/sources/`), which are in no repository. A clone without them
builds the site from the committed parquet and cannot rebuild the data.

## RM8 — Detect possible duplicate species

**State:** waits until 2026-11-17: after the first steps of RM12, which the maintainer asked for first · **Owner:** lead

The three pairs flagged in build 2 come from a hand audit (`POSSIBLE_DUPLICATES`, open questions, item h).
A rule that finds them (one RefSeq record under two names, synonyms in NCBI) and reports, never merges.

## RM9 — A DOI for each build

**State:** after RM4 · **Owner:** lead

`plans/DATA_BUILD2_DECISIONS.md`, section 7: each build is intended for a Zenodo DOI. The seat prepares
the deposit's files and text; publishing is outside its grant.

## RM12 — Longevity in the alignments: sites, selection pressure, convergence

**State:** unattended (steps 1 to 4 ran on 2026-11-13; a continuous-trait model runs until about 2026-11-15; step 5 after it); the code is published in `dna-seq/mitoage-pipelines` · **Owner:** lead

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
6. Where the hits sit on the solved structures of complexes I, III, IV and V (joins RM11 and RM13).

Done so far (2026-11-13, reported in `#mitoalignments`): steps 1 and 2, and step 3 for mammals with a tree
built from the 13 proteins. Two sites pass, one of them a clade marker (ND5 200, the marsupials); the one
to follow is cytochrome b 43, methionine in at least eight separate long-lived lines. Next: the same for
birds, then steps 4 to 6 on that short list.

Each tool's current version and limits are checked before use: the method names above are from memory of the
literature. Reported in `#mitoalignments`; nothing goes on the site before the maintainer has seen it.

## RM16 — Peptides encoded inside mtDNA: kept across species, and against lifespan

**State:** unattended (the pilot ran with the maintainer present) · **Owner:** lead

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

## RM13 — Structural alignments: a check

**State:** after RM12 · **Owner:** lead

The maintainer: "then we can check if we can do structural alignments". A check, not a build: for the
respiratory complexes with solved structures, does aligning by structure (or predicted structure) change
the columns of the well-conserved core, and at what cost for 2,300 species.

## RM11 — mitoport: mitochondrial and nuclear partners against lifespan

**State:** urgent (the maintainer, 2026-11-13: "start this research ... and report in the mitoport topic"); its code lives in `dna-seq/mitoage-pipelines` (the maintainer created it on 2026-11-14 and asked for a reproducible project there, with downloaders, for reviewers of a future manuscript) · **Owner:** lead

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

## RM17 — A complexes section: mitochondrial and nuclear subunits, compared across species

**State:** after RM11 (the maintainer, 2026-11-14, on the proposal below: "so, implement then"); its design goes to him in screenshots before it is live · **Owner:** lead

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

## RM14 — D-loops annotated as a point

**State:** blocked: desk #35 (if nobody answers, nothing changes in the data) · **Owner:** lead

Found reading the live site (RM3): of the 1,976 species with a D-loop annotation, 29 have one of exactly
1 base, 2 of 2 to 9 and 10 of 10 to 99; the rest have a median of 1,051. Each counts as a region today, so
the D-loop's GC content ranges from 0 to 100% in the statistics and these values enter the D-loop
correlations. The rule proposed: under 100 bases counts as not annotated (unknown). A data rule, applied at
the next data build, which runs where the pipeline's inputs are (RM7).

## RM15 — Small things seen on the build 2 site

**State:** unattended · **Owner:** lead

From the reading of 2026-11-13 (20 pages, a desktop's width in light and a phone's in dark, no script error
on any): the hero's decorative stars show through the translucent buttons and chips and cross their text
(the taxon pages' "Compare mtDNA", the gene list's counts on a phone); on the plot, the sentence of the
live statistics says "No clear relationship" where Pearson r is -0.20 with p = 8e-23 and Spearman is -0.015,
so which statistic the sentence follows should be said. Not read: the old addresses kept for links from
the 2015 site (`/browse/`, `/view/`, `/stats-for/`, `/export-section/`).

Seen in the data on the same day, during the site-by-site analysis (RM12): whale families are filed under
two orders in the species table (Balaenidae, Delphinidae and Monodontidae appear under both Artiodactyla
and Cetacea), so a taxon page or a per-order statistic splits them. Which source gives which, and the rule
that makes them one, are not looked at yet.
