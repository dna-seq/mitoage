# Roadmap

Open work only, in order. Each item is a section `## RMn — name` with a line saying its state and its
owner. A done item leaves this file; `docs/CHANGELOG.md` says what landed.

## RM2 — Bring the explorer's payload under its page-weight target

**State:** unattended · **Owner:** lead

`/data/explorer.json` is 2.7 MB with build 2, against 1.5 MB (open questions, item 9). Split it on the
site's side, as the per-gene codon tables are.

## RM3 — Look at the build 2 site

**State:** unattended · **Owner:** lead

Build 2 landed on 2026-11-13 and the site was rebuilt on it: 2,335 species instead of 922, the species
list past 1,000 rows, new classes in every chart and in the tree. The seat can view pages where it runs:
a headless browser screenshots the built site at a phone's and a desktop's width, light and dark (tried
on 2026-11-13 on the home page, the species list, a species page, the tree and Compare: all 20 loaded
without a script error; three were read, the home page, the species list on a phone in dark, the tree).
Left: every section read screenshot by screenshot; what looks wrong becomes its own item. The screenshot
script lives outside the repository until the maintainer says whether its browser library may become a
development dependency.

## RM4 — The build 2 defaults, put to the maintainer

**State:** unattended, under the defaults applied · **Owner:** lead

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

**State:** waits until 2026-11-14: the maintainer's answer in `#mitoage>decisions` (asked 2026-11-13, default: data rebuilds stay on the laptop); unanswered, it goes to the desk · **Owner:** lead

`bun run data` and one test file (`pipeline/tests/lifespan.test.ts`) need the build 1 CSVs (`data/input/`)
and the pinned downloads (`data/cache/build2/sources/`), which are in no repository. A clone without them
builds the site from the committed parquet and cannot rebuild the data.

## RM8 — Detect possible duplicate species

**State:** unattended · **Owner:** lead

The three pairs flagged in build 2 come from a hand audit (`POSSIBLE_DUPLICATES`, open questions, item h).
A rule that finds them (one RefSeq record under two names, synonyms in NCBI) and reports, never merges.

## RM9 — A DOI for each build

**State:** after RM4 · **Owner:** lead

`plans/DATA_BUILD2_DECISIONS.md`, section 7: each build is intended for a Zenodo DOI. The seat prepares
the deposit's files and text; publishing is outside its grant.

## RM10 — Alignments on the gene pages

**State:** unattended · **Owner:** lead

The alignments exist (`bun run align`, `public/data/alignments/`, D5). On each gene page: an alignment
viewer (rows in the tree's order, a conservation track, lifespan beside each row, a filter by taxon) and
the downloads; the Data page lists the files. The viewer loads one gene's file, not all.

## RM12 — Sites that go with lifespan

**State:** unattended · **Owner:** lead

First, the aligner (the maintainer asked whether newer tools do better; no Rust one was found, the
contenders are FAMSA2 and Muscle5): the 13 proteins aligned with MAFFT's fast mode (the pin), a more
accurate MAFFT mode, FAMSA2 and Muscle5, how much the columns differ and where, reported in the channel;
the pin changes only on a clear difference. Then: per-site association of each alignment column with maximum lifespan on the dated tree, controlling for
body mass and for nucleotide bias (Jobson 2010, Aledo 2012), corrected for the number of sites. Positive
controls first: cysteine, methionine and threonine content against lifespan must come out as published.
Hits are compared with the positions of Mariadassou & Pellay 2014 (doi:10.1016/j.exger.2014.03.009), whose
full text is needed. Poorly aligned columns are left out by an occupancy rule set before looking at results.
Reported in `#mitoalignments`; nothing goes on the site before the maintainer has seen it.

## RM13 — Structural alignments: a check

**State:** after RM12 · **Owner:** lead

The maintainer: "then we can check if we can do structural alignments". A check, not a build: for the
respiratory complexes with solved structures, does aligning by structure (or predicted structure) change
the columns of the well-conserved core, and at what cost for 2,300 species.

## RM11 — mitoport: mitochondrial and nuclear partners against lifespan

**State:** waits until 2026-11-14: the maintainer's go on a bounded test, asked in `#mitoage>mitoport` on 2026-11-13; unanswered, it goes to the desk · **Owner:** lead

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
