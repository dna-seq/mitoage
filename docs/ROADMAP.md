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

**State:** blocked: on the maintainer naming where pages are looked at · **Owner:** lead

Build 2 landed on 2026-11-13 and the site was rebuilt on it: 2,335 species instead of 922, the species
list past 1,000 rows, new classes in every chart and in the tree. On the cluster the seat builds and
cannot view. Each section at a phone's and a desktop's width, light and dark; what looks wrong becomes
its own item.

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

**State:** blocked: on the maintainer saying where the inputs come from · **Owner:** lead

`bun run data` and one test file (`pipeline/tests/lifespan.test.ts`) need the build 1 CSVs (`data/input/`)
and the pinned downloads (`data/cache/build2/sources/`), which are in no repository. A clone without them
builds the site from the committed parquet and cannot rebuild the data.

## RM8 — Detect possible duplicate species

**State:** unattended · **Owner:** lead

The three pairs flagged in build 2 come from a hand audit (`POSSIBLE_DUPLICATES`, open questions, item h).
A rule that finds them (one RefSeq record under two names, synonyms in NCBI) and reports, never merges.

## RM9 — A DOI for each build

**State:** blocked: the maintainer's to publish · **Owner:** lead

`plans/DATA_BUILD2_DECISIONS.md`, section 7: each build is intended for a Zenodo DOI. The seat prepares
the deposit's files and text; publishing is outside its grant.
