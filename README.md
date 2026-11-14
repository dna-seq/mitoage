# MitoAge

Static website for **MitoAge**, a database for comparative analysis of mitochondrial DNA with a
special focus on animal longevity: the mitochondrial genomes of hundreds of animal species, from base
composition to codon usage, against their maximum lifespan.

Built with [Astro](https://astro.build) (static output), [SolidJS](https://www.solidjs.com) islands and
d3 scales. All code is TypeScript. Runs on [Bun](https://bun.sh).

## Commands

| Command | What it does |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run data` | Run the data pipeline (`pipeline/`), writing `src/data/generated/` and `public/data/` |
| `bun run align` | Align the 13 proteins and two rRNAs of every live species with MAFFT (pinned version), writing `public/data/alignments/` |
| `bun run hf` | Package the committed build for Hugging Face into `out/hf/`: the data files, the alignments as one parquet table, the dataset card. The dataset is [longevity-genie/mitoage](https://huggingface.co/datasets/longevity-genie/mitoage) |
| `bun run dev` | Dev server |
| `bun run build` | Build the static site into `dist/` |
| `bun run preview` | Serve `dist/` locally (set the same `BASE_PATH` as the build) |
| `bun run check` | Type-check `.ts`/`.tsx` with TypeScript 7 (`.astro` files are not covered: `astro check` does not support TypeScript 7.0) |
| `bun test` | Unit tests: pipeline, tree layout, explorer and comparative statistics |

### Deploy targets and the base path

`astro.config.ts` reads the deploy target from the environment:

| Target | `SITE_URL` | `BASE_PATH` |
| --- | --- | --- |
| Own domain (default) | `https://www.mitoage.info` | `/` |
| GitHub Pages (live at <https://just-dna.life/mitoage/>) | `https://just-dna.life` | `/mitoage` |

```sh
SITE_URL=https://just-dna.life BASE_PATH=/mitoage bun run build
```

Every push to `main` deploys through `.github/workflows/deploy.yml`. The workflow fails if any
built page has a root-absolute link without the base path.

Every internal URL must go through `href()` from `src/lib/url.ts` (or the helpers in
`src/lib/urls.ts`, which already call it): links, fetches from islands, download links, icons,
canonical and Open Graph URLs. Never hard-code a root-absolute path such as `"/species/"`.

## Layout of the code

```
src/
  data/            data contract (schema.ts) and access layer (index.ts), generated JSON
  styles/          tokens.css (design tokens, light + dark), global.css, components.css, charts.css
  layouts/         BaseLayout.astro: SEO, Open Graph, JSON-LD, theme, header and footer
  components/
    brand/         the mitochondrion, the round badge, the compact icon
    ui/            Header, Footer, Hero, Card, StatCard, Button, Chip, Breadcrumb, TabNav (in-page),
                   SectionTabs (between the pages of a section), CompositionBar, DataTable (sortable,
                   filterable, CSV export, FASTA of the filtered rows; `figure` draws a chart of
                   the rows it shows), SearchBox, CodonHeatmap, LinearGenomeTrack (unused)
    charts/        Scatter (reusable scatter-plot island), RangePlot (rows of ranges, bars and dots)
    genome/        circular genome map (GenomeExplorer adds the species switch of the genes
                   pages), gene-page charts and correlation tables, AlignmentViewer (the gene's
                   alignment on a canvas: species by columns, conservation, lifespan beside the rows)
    tree/          zoomable radial taxonomy tree (canvas), clade scatter and species table (with the
                   FASTA of its species), taxon-page cards
    species/       the species list (genome and life-history views)
    compare/       Compare section: CompareNav; stats/ holds the comparative tables (regions,
                   child taxa, codon usage, every species of a region) and their charts (RowsChart,
                   CorrMap, CodonBars, SpeciesScatter); Compare.tsx, DotPlot and Marker are the
                   species side-by-side view (with the FASTA of the chosen species)
    explore/       the plot explorer (shown at /compare/plot/): axis picker, strongest correlations
  lib/             URL helpers, formatting, class colours, genetic codes, JSON-LD builders, CSV,
                   FASTA from NCBI (fasta.ts asks, fastaDownload.ts is the download an island
                   starts; testdata/ holds three real records for their tests);
                   genome/, tree/, explore/ and compare/ hold the logic behind those components
                   (compare/legacy.ts maps the old site's taxon ids for redirects)
  pages/           routes, below
```

The site is mtDNA-first. Menu: **Species · Tree · Genes · Compare · Data · About**.

| Route | What it is |
| --- | --- |
| `/species/`, `/species/life-history/` | Species list: genome view and life-history (AnAge) view; the filtered rows download as CSV and their genomes as one FASTA file; one page per species |
| `/tree/`, `/taxa/{rank}/{slug}/` | Taxonomy tree and taxon pages; a taxon page's species table offers the genomes of its species (after the table's filter) as one FASTA file |
| `/genes/`, `/genes/{gene}/` | The 13 protein-coding genes, rRNAs and D-loop; each protein and rRNA page shows the gene aligned across species (`public/data/alignments/`) |
| `/compare/`, `/compare/{class,order,family}/{slug}/` | Comparative mtDNA statistics of all species or one taxon (3+ species): every region on one parameter (GC %, AT %, A/T/G/C %, GC and AT skew, length) with n, mean, SD, CV, min, median, max and r with log10 lifespan; the child taxa on one region; codon and amino-acid usage. Each table has a chart of its rows (`?chart=`: distribution, variation, lifespan r with its 95% interval, or the map of r for every region and parameter); codon usage is also drawn by amino acid (`?bars=share`) |
| `/compare/regions/`, `/compare/regions/{region}/` | One region in every species: all parameters, by class, order or family (with the same chart), and each species' values, with a scatter of the listed species on any two parameters or lifespan (`?x=&y=`) |
| `/compare/species/?species=a,b` | Two to six species side by side, genome first; their genomes download as one FASTA file, in the order chosen |
| `/compare/plot/?x=&y=&scope=` | Plot explorer: any two mtDNA features, or one against a life-history trait |

Old URLs get static redirects: `/explore/` (keeps the query), `/compare/?species=`,
`/stats-for/...`, `/export-section/...`, `/browse/...`, `/statistics/` and `/view/{id}/species/`.
They are left out of the sitemap (`astro.config.ts`).

Pages read data only through `~/data` (`src/data/index.ts`), which is server-side. It loads the committed
parquet downloads in `public/data/` (species, region_stats, codon_usage, genome_features) with hyparquet once, at
build time (a top-level await), plus the small JSON in `src/data/generated/` (build-info, taxonomy, phylogeny);
feature values and correlations are derived from them during the build (decision D3), using the pure
functions in `pipeline/steps/` and `pipeline/lib/` (never `pipeline/lib/cache.ts`, which is Bun-only).
`/data/explorer.json` and `/data/correlations.parquet` are build-time endpoints (`src/pages/data/`). Islands receive
data as props or fetch static JSON emitted at build time (`/search-index.json`,
`/species/gc-lifespan.json`, `/species/{slug}.json`, `/species/table.json`, `/species/retired.json`, `/tree/tree.json`,
`/genes/{gene}/gc-lifespan.json`, `/genes/alignment-species.json`, `/compare/plot/correlations/{trait}/{scope}.json`,
`/compare/plot/values/{chunk}.json`, `/compare/species-index.json`, `/compare/taxonomy.json`,
`/compare/stats/{group}.json`, `/compare/codons/{group}.json`, `/compare/values/{region}.json`
and `.csv`, `/data/*`). Large tables render their first view at build time and load the rest, and
island props are packed (`packRows` in `src/lib/compare/rows.ts`), to keep pages under about 150 KB.

The site hosts no sequences. A species page links to its FASTA and GenBank record at NCBI, and
"FASTA of these rows" on the species list (`DataTable`'s `fasta` prop, `src/lib/fasta.ts`) fetches
the filtered species' RefSeq records from NCBI E-utilities in the browser, 100 accessions a request,
and offers them as one file in the table's order. NCBI answers 200 and leaves out a record it does
not have, so every answer is checked against the accessions asked for: the page names the missing
ones, and a request that fails (after three attempts for no answer, a 429 or a 5xx) saves nothing.

The same download, `downloadFasta` in `src/lib/fastaDownload.ts` (fetch, save, and the sentence
shown), serves two more places, so all three say the same things:

- **Taxon pages**: the species table (`CladeSpeciesTable`) passes `fasta` to its `DataTable` once it
  holds every species of the clade. A large clade starts with its first page of rows and loads the
  rest from `/tree/tree.json`; until then there is no button, because a file of the first 20 genomes
  would pass for the clade's. Both sources build their rows in `src/lib/tree/speciesRows.ts`, and
  the tree payload carries each species' accession for this (`leaf.refseq`, which added 32.7 KB to
  the 306.4 KB file of build 2, 8.1 KB to its 96.7 KB gzipped).
- **Species side by side**: "FASTA of these species" asks for the chosen species in the order of
  their cards (`src/lib/compare/speciesFasta.ts`). The accession comes with each species' record
  (`/species/{slug}.json`), so `/compare/species-index.json` is unchanged. A chosen entry that did not
  load is named as left out.

All three name the build's retired records a file holds (`src/lib/retired.ts`). The site still lists
retired species, most of them because RefSeq removed their record, and NCBI still serves a removed
record, so without this a download would hand one out under a plain "Downloaded". The record stays
in the file, since it is one of the rows asked for; the note names it and turns amber. The list is
`/species/retired.json` (record status "retired", by accession, 1.6 KB), fetched once per page when a
download starts; if it cannot be read, the note says the check could not be made, never that there
is no retired record.

The charts of the Compare section draw what `src/lib/compare/charts.ts` returns: it turns the rows
of a table into the marks of a range chart, a group's summaries into the lifespan-correlation map
(q-values by Benjamini–Hochberg over the map), codon summaries into rows by amino acid and species
rows into scatter points. A chart inside a `DataTable` (`figure`) is given the rows the table shows,
so it follows the table's sorting, page and filters and cannot disagree with it. A chart that is
itself a `<table>` (CorrMap) stays outside the `DataTable`, whose cell styles would reach it.

The taxonomy tree (`src/components/tree/RadialTree.tsx`) draws on a canvas and zooms with d3-zoom
(part of `d3`). Its maths is pure and tested in `src/lib/tree/`: `layout.ts` places the tree,
`camera.ts` maps it to the screen (semantic zoom: the ring, arcs and text keep their size; in the rank
layout ranks never sit more than one step apart, so a genus and its family fit with readable names),
fits a clade into view and hit-tests, and `labels.ts` places clade names on their stems.
`treeDraw.ts` does the drawing. OneZoom was considered and not used: its licence is non-commercial
and share-alike, and it is built around its own data pipeline.

Section stylesheets (`genome.css`, `tree.css`, `explorer.css`, `compare.css`,
`compare/stats/stats.css`) are imported by the pages, not the islands, and each starts with
`@layer tokens, reset, base, components, utilities;`. Keep that line in any new stylesheet: a
sheet bundled before `global.css` would otherwise reorder the cascade layers for the whole page.

## Design system

The look follows the "Trust me, I'm a Biologist" brand: dark-green to lime gradients, a faceted
low-poly texture with a constellation of dots and lines, a round green badge with arc lettering and
heavy rounded type (Nunito, self-hosted).

* **Tokens** live in `src/styles/tokens.css`. Components use semantic tokens (`--color-*`,
  `--grad-*`, `--shadow-*`, `--radius-*`, `--space-*`, `--fs-*`), never raw palette values.
  Dark theme redefines the same tokens (OS preference, or the header toggle, stored in
  `localStorage` as `mitoage-theme`).
* **Data colours** are fixed site-wide: nucleotides `--nt-a`, `--nt-t`, `--nt-g`, `--nt-c`,
  `--nt-other`; taxonomic classes `--class-*` (see `src/lib/classes.ts`); genome feature types
  `--feat-cds`, `--feat-rrna`, `--feat-trna`, `--feat-dloop`; charts `--chart-*`; heatmap
  `--heat-lo`, `--heat-hi`; the diverging ramp of correlation maps `--diverge-neg`,
  `--diverge-zero`, `--diverge-pos`; text on a nucleotide colour `--nt-on`, `--nt-on-g`.
* **Navigation** comes from `NAV_ITEMS` and `FOOTER_LINKS` in `src/lib/site.ts`.

## Data sources and citation

Mitochondrial genomes from NCBI RefSeq (build 2: release 237); lifespan and life-history traits from AnAge
(build 15); where AnAge has no maximum lifespan, FishBase (fish), SeaLifeBase (aquatic invertebrates) and the USGS
Bird Banding Laboratory (birds). FishBase and SeaLifeBase values are CC BY-NC 4.0. Build 1 is frozen in
`public/data/build1/`; every change since is in `public/data/changelog.parquet`.

Toren D, Barzilay T, Tacutu R, Lehmann G, Muradian KK, Fraifeld VE. MitoAge: a database for
comparative analysis of mitochondrial DNA, with a special focus on animal longevity.
*Nucleic Acids Res.* 2016;44(D1):D1262–5. doi:10.1093/nar/gkv1187
