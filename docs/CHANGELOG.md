# Changelog

Newest first.

## Unreleased

- **Figures for the manuscript draft, and screenshots in the README.** `docs/manuscript/figures/` holds
  Figure 1 (species list, tree, a Compare chart, a genome map), Figure 2 (the plot explorer and its
  ranking of every feature) and a new Figure 5 (the COX1 alignment of the mammals), all screenshots of the
  build 2 site; the draft shows them with legends whose numbers were read off the screenshots. Figures 3
  and 4 (charts of the correlation table) are still to be drawn. `docs/screenshots/` holds six screenshots
  the README now shows, and the README points to the draft. `NOTES.md` says how the screenshots were
  taken. Found on the way: headless Chrome 157 returns a stale computed colour when an element's inline
  style changes, so the tree and the alignment viewer, which resolve their colours through one probe
  element, drew in one colour there; the capture worked around it. A headed Chrome 157 draws both
  correctly on the live site, so the site is unchanged.
- `docs/manuscript/`: draft 0.1 of the MitoAge 2 paper (NAR Database issue update), modelled on the 2016 paper, with every number traced to build 2 in `NOTES.md` and the questions for the authors (strand convention, contrasts in poorly resolved clades, licence, taxonomy counts).
- **A FASTA download names the retired records it holds.** Build 2 retired 19 species (18 because
  RefSeq removed their record, one without a curated lifespan), and the site still lists them. NCBI
  still serves the removed records, so the species list, a taxon page and the side-by-side view
  handed them out under a plain "Downloaded": on the Squamata page, 4 of the 65 genomes. The record
  stays in the file, since it is one of the rows asked for; the note now names it, says it is left
  out of the build's correlations and alignments, and turns amber. The list is the new
  `/species/retired.json` (record status "retired", by accession, 1.6 KB), fetched once per page when
  a download starts; when it cannot be read the note says the check could not be made, never that
  there is none. `src/lib/retired.ts`, tested on the build's species and on two removed records as
  NCBI serves them (`src/lib/testdata/retired.fasta`), and checked by breaking the code 14 ways.
- **FASTA of a hand-picked set of species and of a taxon's species**, the two places the species
  list's download did not reach (see its entry below):
  - `/compare/species/?species=a,b`: "FASTA of these species" downloads the genomes of exactly the
    chosen species, in the order of their cards. A chosen entry that did not load is named as left
    out.
  - `/taxa/{rank}/{slug}/`: the species table has the same button, for the rows the table shows
    after its filter and in its order. On a clade of more than 30 species the button appears once
    the rest of the rows has loaded, not while the table holds its first page only.

  Both show what the species list shows for a complete, an incomplete and a failed download: the
  flow moved out of `DataTable` into `src/lib/fastaDownload.ts`, and `src/lib/fasta.ts` is
  unchanged. `/tree/tree.json` gains `leaf.refseq`, the versioned accession of every species. On
  the build 2 data (2,335 species) the file grows from 306,425 to 339,126 bytes (+32,701, 10.7%),
  with `gzip -9` from 96,650 to 104,765 (+8,115, 8.4%). Two integers per species instead of the
  string would have made it 324,697 bytes (103,415 gzipped), 1.35 KB less on the wire, and tied the
  format to `NC_` plus six digits; the string was kept. `/compare/species-index.json` is unchanged,
  since the side-by-side view already loads each species' record with its accession. Each inline
  row of a taxon page's table carries the accession too.

  Found on the way and left as it is: the 50 species of build 2 without an order or a family have
  an empty group in a taxon page's inline rows and "Unknown order" or "Unknown family" in the rows
  loaded from the tree (`src/lib/tree/speciesRows.test.ts` states the difference).
- Roadmap: RM16, the peptides encoded inside mtDNA (humanin, MOTS-c, the alternative frames of ND4 and COX1 and the rest), asked by the maintainer; the aligner check, RM12's first step, is done and reported in `#mitoalignments`. Documents only.
- **Gene pages no longer scroll sideways on a phone.** The button under the class chart ("Compare ND6 across
  taxa: every parameter, every species") was wider than a phone's screen and widened the whole page by 135
  pixels; its label is now "Compare ND6 across taxa". Found by reading the live build 2 site (RM3): 20 pages
  at a desktop's and a phone's width, none with a script error, this one with a page wider than its screen.
  What else was seen is RM14 (D-loops annotated as a point) and RM15.
- Roadmap: RM12 is now the whole longevity analysis on the alignments as planned with the maintainer (aligner check, positive controls, site by site, selection pressure, convergence, structures); RM4, RM7 and RM11 wait on the desk. Documents only.

- **The build on Hugging Face** (D6). `bun run hf` packages the committed build into `out/hf/` (not in
  git): `public/data/` as it is, `alignments/alignments.parquet` (every row of every aligned FASTA as one
  table: gene, kind, slug, scientific name, accession, aligned sequence; 64,789 rows, 22 MB, read back and
  compared after writing) and a dataset card made of the data README and the alignments README under a
  header that says the licence is mixed, part non-commercial, and names the tables the dataset viewer
  shows. Uploaded by hand to https://huggingface.co/datasets/longevity-genie/mitoage (public, 46 MB) on
  2026-11-13. The site still builds from the files in git; nothing on the site reads Hugging Face.
- **The alignment on each gene page** (RM10). The pages of the 13 proteins and the two rRNAs have a section
  "Alignment": one row per species in the order of the site's tree, the residues coloured by side chain (the
  bases by letter), a bar above each column for how conserved it is among the rows on show, and the maximum
  lifespan beside each row. Filter by class and order, sort by lifespan, switch to an overview of small cells,
  hide the columns where more than half of the rows have a gap (on at the start), find a species; a cell
  tells its species, column and residue, with a link to the species page. The viewer fetches that gene's
  protein (or rRNA) file and one list of species (`/genes/alignment-species.json`) when it scrolls into view;
  the protein, codon and rRNA files are linked under it. The codon alignment is a download, not drawn. The
  Data page lists the alignment files in a card of their own, each described as what it is (before, the
  codon alignments carried the description of the codon-usage table). `src/lib/alignment.ts` is tested on
  the committed files (its column counts equal the manifest's, which the pipeline counts another way) and
  by breaking the gap rule and the conservation share.
- **Alignments of the mitochondrial genes** (D5, RM10's first part). `bun run align` aligns each of the 13
  proteins (amino acids), derives the codon alignment each implies, and aligns the 12S and 16S rRNA genes,
  for the 2,316 live species of build 2, from the pinned RefSeq release, with MAFFT v7.526 (FFT-NS-2;
  another version stops the run). Output: `public/data/alignments/`, 28 gzipped FASTA files (11 MB), a
  manifest (`alignments.json`: counts, columns, checksums, the 31 gene absences, the 48 genes annotated
  twice, 2 codon rows left out for a frameshift in the record) and a README. Checked: every alignment is
  its input with gaps; every codon row translates to its protein under the species' genetic code (no
  mismatch in any of the 13 genes); two runs with 2 and 8 threads give identical files. Tests on the
  committed files and on the library, one of them confirmed by breaking the codon threading. Not on the
  site's pages yet: the files are served under `/data/alignments/`.
- Roadmap: RM10 gains the prior-art check on alignments and site-level lifespan screens; RM11 records the mitoport idea and the bounded test proposed for it. Documents only.
- **A species page says where its record comes from** (RM1). The lifespan card and the life-history card
  link to the source that holds the value (AnAge, FishBase, SeaLifeBase or the USGS longevity records);
  before, every species linked to AnAge, also the 575 whose value comes from another source. A new card,
  "About this record", gives the source and its version, what the value is based on (captivity, the wild,
  an estimate), its quality, its licence with a line where the value is non-commercial, the record's
  status against build 1 with its dates, an earlier name, and the review flags as sentences. A retired
  species carries a notice with its reason at the top of the page. Words and links are in
  `src/lib/provenance.ts`, tested on every species of the build and by breaking the link rule. Viewed
  as screenshots of the built page at a desktop's and a phone's width, light and dark, for a FishBase
  species, a renamed one, a retired one and human.
- Roadmap: RM10, multiple sequence alignments of the 13 proteins and two rRNAs, with the numbers of a hand run (MAFFT, all 2,316 live species, under a minute in total) and a proposed design waiting for the maintainer; RM3 is no longer blocked, since built pages can be viewed by headless screenshots where the seat runs. Documents only.
- The roadmap is written (RM1 to RM9) from the build 2 report's "Not done", its open questions and the code as it is; the lead's notes record its first seating. Documents only. Checked on the pulled tree: type check, the site build as the workflow runs it (7,783 pages, link check passed); tests pass except `pipeline/tests/lifespan.test.ts`, which needs the pinned inputs this clone lacks (RM7). No page was viewed.
- The build 2 report states the final test count (192, not 144).
- Decision numbers after rebasing onto main (which recorded its own D2): the parquet data layer is D3 and the dropped size rule D4 in code comments and the build 2 report.
- The FASTA download test formats its expected counts with the thousands separator the message uses (it failed once the species list passed 1,000 rows with build 2).
- Regenerated build 2 data (`bun run data`, 2026-11-13): 2,335 species; `public/data/` holds species, region_stats, codon_usage, genome_features, lifespan_observations and changelog parquet, species.csv, review_list.csv, README and the frozen build1/; `src/data/generated/` holds build-info, taxonomy and phylogeny JSON. The JSON copies of the large tables (species, region stats, codon usage, genome features, feature defs and values, correlations) and the committed explorer.json/correlations.parquet are removed (D2).
- Build 2 documents: `docs/BUILD2_REPORT.md` (counts, change tables, lifespan source x class, AnAge-only vs extended correlations, pinned versions, cross-check agreement, file sizes, what was not done; tables from `bun run pipeline/report.ts`), `docs/BUILD2_CROSSCHECK.md` (from `bun run pipeline/crosscheck.ts`) and `docs/BUILD2_OPEN_QUESTIONS.md` (each default with its alternative and cost).
- Decision D4: the 5 MB per-file rule is dropped from CLAUDE.md (the maintainer: "so drop this rule"); `validate.ts` now checks committed outputs against GitHub's own limits (fails at 100 MB, warns at 50 MB). D3 is unchanged: correlations and explorer.json are still computed at site build.
- New lampreys are labelled `Cephalaspidomorphi` and new lungfish/coelacanths `Sarcopterygii`, as in build 1, so class scopes stay comparable with the 2016 paper (they had been given NCBI-style `Hyperoartia`/`Dipnoi`/`Coelacanthi`).
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
