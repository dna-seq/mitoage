# Changelog

Newest first.

## Unreleased

- Decision D3: the site reads the committed parquet (`public/data/`) at build time through `src/data/index.ts` (hyparquet, top-level await, DataApi unchanged; `getCorrelations` takes an optional `dataset`); feature values, correlations (default and AnAge-only datasets, PIC on the committed `phylogeny.json`) and `explorer.json` are computed during `bun run build` and served as `/data/explorer.json` and `/data/correlations.parquet`; the large JSON copies are no longer committed. The dated-tree test now checks that exactly the species missing from the committed tree lack a branch length, instead of a build 1 count.
- Build 2 assembly (`pipeline/steps/build2.ts`, `bun run data`): the 922 build 1 species are re-verified against RefSeq release 237 (884 same accession.version, 2 new versions, 18 switched to a live species-level successor, 17 retired without one; Andrias davidianus retired, no curated lifespan), renamed to the NCBI name where NCBI transferred them (old name kept in `previous_scientific_names`, slug kept), and get AnAge build 15 lifespans; 1,413 new species (complete RefSeq mitogenome + curated lifespan) get id 10,000,000 + NCBI taxid. Genome values of live species are computed from the release record (annotated segments only for join() features); retired species keep their build 1 values. Every difference against build 1 is in `public/data/changelog.parquet` with its class (`steps/diff.ts`: rule_full_span, upstream re-annotation against the source INSDC record, gap fill, successor, ...) and rule-scoped corrections for the complement-labelled base columns and the full-span rule; every lifespan value of every source is in `lifespan_observations.parquet`; unresolved matches go to `review_list.csv`. `validate.ts` checks row metadata against the changelog, unique and correctly minted ids and slugs, one licensed chosen lifespan per species, the priority rule and the 5 MB limit of committed files. `bun run pipeline/crosscheck.ts` compares the output with the audit tables.
- Pinned build 2 sources in TypeScript (`pipeline/sources/`): RefSeq mitochondrion release 237 (md5-checked, streamed), NCBI Taxonomy new_taxdump (names with synonyms), AnAge build 15 (md5-pinned), FishBase and SeaLifeBase v26.06, USGS BBL v2025.1, and EURING, whose absence is reported ("EURING: not retrieved") and never substituted. A missing pinned input stops the build. Matching (`steps/lifespan.ts`): NCBI taxid first, then scientific name, NCBI synonym, the source's synonym table, binomial of a trinomial; ambiguous matches are excluded, never guessed. Per-taxon precedence: AnAge > FishBase (fish) / SeaLifeBase (aquatic invertebrates) / EURING > USGS BBL (birds). One complete RefSeq mitogenome per species (`steps/refseq.ts`). Tests on real source rows, each checked by breaking the code it guards.
- Data contract for build 2 (`src/data/schema.ts`): row provenance (`RowProvenance`: added/last-modified build and date, `record_status`, `source_version`) on species, region stats, codon usage and genome features; species lifespan metadata (`LifespanInfo`: source, version, record id, quality, sample size, record type, licence), NCBI taxids, previous names, retired reason, review flags, change kinds; `LifespanObservation`, `ChangelogEntry`, correlation datasets (`default`, `anage_only`). All new fields are optional, so build 1 consumers keep working.
- Frozen build 1 snapshot: `bun run data` converts every 2015 CSV verbatim to `public/data/build1/*.parquet` (lossless typing, SHA-256 of each source CSV in `build1/README.md`); tested by a cell-by-cell round trip.
- **Charts in the Compare section.** Every comparative table now has a chart of its rows above it,
  with a switch for what the chart shows (`?chart=`):
  - *Distribution*: range, mean ± SD, median and mean of the parameter, one row per region or taxon
    (lengths of the regions on a log scale).
  - *Variation*: the coefficient of variation, or the SD for the skews.
  - *Lifespan r*: Pearson r with log10 maximum lifespan and its 95% confidence interval (Fisher z).
  - *Lifespan map* (regions only): r of every parameter in every region of the group, with the cells
    whose Benjamini–Hochberg q-value over the map is below 0.05 in bold. AT % is left out of the
    map, as the mirror of GC %.

  The chart follows the table's sorting and page. Region pages gain a scatter of the listed species
  with selectable axes (any two of the region's parameters, or one against lifespan; `?x=&y=`), which
  narrows with the table's search and class filter and reports Pearson and Spearman for the plotted
  species. Codon usage is drawn by amino acid, each codon a segment coloured by its third base, as a
  share of all codons or within the amino acid (`?bars=share`). None of the charts' statistics is
  corrected for shared ancestry; the plot explorer remains the place for phylogenetic contrasts.
- `CLAUDE.md` §2: a session without a seat pushes `main` as a fast-forward where the maintainer's
  global instructions give a standing permission to push (D2 in `docs/DECISIONS.md`).
- The species list (`/species/`, `/species/life-history/`) has a "FASTA of these rows" button: the
  mitochondrial genomes of the filtered species as one file, in the table's order. The site still
  hosts no sequences: the browser fetches the RefSeq records from NCBI E-utilities, 100 accessions a
  request (`src/lib/fasta.ts`, `DataTable`'s `fasta` prop). NCBI answers 200 and leaves out a record
  it does not have, so every answer is checked against the accessions asked for and the page names
  any that are missing; a request that fails saves nothing and says why. `/species/table.json` gains
  a `refseq` field. Not on the taxon pages' species tables, nor on the species side-by-side view.

- The genome map on the genes index and on every gene page switches species: a search box and
  quick picks (human, house mouse, naked mole-rat, bowhead whale, chicken, zebrafish, fruit fly)
  load `/species/{slug}.json` and redraw the map, keeping the gene of the page highlighted. The
  species is kept in `?species=`. Before, both maps were fixed to the human genome.
- The site is mtDNA-first (1bcf523, landed before this changelog existed). Menu: Species, Tree,
  Genes, Compare, Data, About. Compare holds the comparative statistics of the original site's
  stats pages (every region by parameter with n, mean, SD, CV, min, median, max and r with log10
  lifespan; child taxa; codon usage; per-region pages with every species' values, CSV
  everywhere), the species side-by-side view and the plot explorer (moved from `/explore/`).
  Life-history traits live under Species (`/species/life-history/`). Old `/stats-for/`,
  `/export-section/`, `/browse/`, `/statistics/` and `/explore/` URLs redirect.
