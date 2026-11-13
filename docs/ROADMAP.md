# Roadmap

Open work only, in order. Each item is a section `## RMn — name` with a line saying its state and its
owner. A done item leaves this file; `docs/CHANGELOG.md` says what landed.

## RM1 — Show a species' lifespan source, licence and record status on its pages

**State:** unattended · **Owner:** lead

Build 2 carries them in the contract (`Species.lifespan`, `provenance`), and 549 species show FishBase or
SeaLifeBase values under CC BY-NC 4.0, said only in the downloads README (`docs/BUILD2_OPEN_QUESTIONS.md`,
item 11; `plans/DATA_BUILD2_DECISIONS.md`, section 8). The species page names the source, its version and
licence, the record type and quality, and marks a retired or renamed species with its reason and old names.

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

## RM10 — Multiple sequence alignments of the mitochondrial genes

**State:** waits until 2026-11-14: the maintainer's go on the design, asked in `#mitoage>decisions` on 2026-11-13 while they were answering there; unanswered, it goes to the desk · **Owner:** lead

Asked by the maintainer (2026-11-13): "check if we can prepare multiple sequence alignments between
mitochondria of different species to find some insights and also provide it through website".

It can be done. A hand run on 2026-11-13, from the pinned RefSeq release 237 and the 2,316 non-retired
species of build 2: the 13 proteins and the two rRNAs extracted with the pipeline's own GenBank parser
(12 s), each aligned with MAFFT 7.526 (`--auto`, 8 threads): every protein in 1 to 5 s, 12S rRNA in 12 s,
16S in 29 s. All 15 alignments are 5.4 MB gzipped. COX1 is the most conserved (415 of 515 well-occupied
columns carry one residue in 90 % of species), ATP8 and ND6 the least. Six records have no sequence in
the release file and need the fetch the pipeline already does for them. No insight was looked for yet:
the run shows cost and size only.

The design proposed, each point the maintainer's to change:

1. **What is aligned:** each of the 13 proteins as amino acids, the codon alignment derived from it, and
   the two rRNAs. No whole-genome alignment: gene order differs between phyla, so it would not mean much.
2. **The tool:** MAFFT, a program the pipeline calls, pinned by version. It is the first step of the
   pipeline that is not TypeScript; the alignments are committed outputs, so the site build needs no
   MAFFT. Rejected: an aligner written in TypeScript (far slower and worse on 2,300 sequences).
3. **Insights, first set:** conservation per site; sites whose residue goes with maximum lifespan, tested
   with the dated tree the pipeline already has (phylogenetic contrasts) and corrected for the number of
   sites; nothing claimed from an uncorrected comparison.
4. **The site:** on each gene page an alignment viewer (rows in the tree's order, a conservation track,
   lifespan beside each row, a filter by taxon) and the aligned FASTA as a download.
