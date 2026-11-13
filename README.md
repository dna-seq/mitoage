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
                   filterable, CSV export), SearchBox, CodonHeatmap, LinearGenomeTrack (unused)
    charts/        Scatter (reusable scatter-plot island)
    genome/        circular genome map (GenomeExplorer adds the species switch of the genes
                   pages), gene-page charts and correlation tables
    tree/          zoomable radial taxonomy tree (canvas), clade scatter and species table, taxon-page cards
    species/       the species list (genome and life-history views)
    compare/       Compare section: CompareNav; stats/ holds the comparative tables (regions,
                   child taxa, codon usage, every species of a region); Compare.tsx, DotPlot and
                   Marker are the species side-by-side view
    explore/       the plot explorer (shown at /compare/plot/): axis picker, strongest correlations
  lib/             URL helpers, formatting, class colours, genetic codes, JSON-LD builders, CSV;
                   genome/, tree/, explore/ and compare/ hold the logic behind those components
                   (compare/legacy.ts maps the old site's taxon ids for redirects)
  pages/           routes, below
```

The site is mtDNA-first. Menu: **Species · Tree · Genes · Compare · Data · About**.

| Route | What it is |
| --- | --- |
| `/species/`, `/species/life-history/` | Species list: genome view and life-history (AnAge) view; one page per species |
| `/tree/`, `/taxa/{rank}/{slug}/` | Taxonomy tree and taxon pages |
| `/genes/`, `/genes/{gene}/` | The 13 protein-coding genes, rRNAs and D-loop |
| `/compare/`, `/compare/{class,order,family}/{slug}/` | Comparative mtDNA statistics of all species or one taxon (3+ species): every region on one parameter (GC %, AT %, A/T/G/C %, GC and AT skew, length) with n, mean, SD, CV, min, median, max and r with log10 lifespan; the child taxa on one region; codon and amino-acid usage |
| `/compare/regions/`, `/compare/regions/{region}/` | One region in every species: all parameters, by class, order or family, and each species' values |
| `/compare/species/?species=a,b` | Two to six species side by side, genome first |
| `/compare/plot/?x=&y=&scope=` | Plot explorer: any two mtDNA features, or one against a life-history trait |

Old URLs get static redirects: `/explore/` (keeps the query), `/compare/?species=`,
`/stats-for/...`, `/export-section/...`, `/browse/...`, `/statistics/` and `/view/{id}/species/`.
They are left out of the sitemap (`astro.config.ts`).

Pages read data only through `~/data` (`src/data/index.ts`), which is server-side. Islands receive
data as props or fetch static JSON emitted at build time (`/search-index.json`,
`/species/gc-lifespan.json`, `/species/{slug}.json`, `/species/table.json`, `/tree/tree.json`,
`/genes/{gene}/gc-lifespan.json`, `/compare/plot/correlations/{trait}/{scope}.json`,
`/compare/plot/values/{chunk}.json`, `/compare/species-index.json`, `/compare/taxonomy.json`,
`/compare/stats/{group}.json`, `/compare/codons/{group}.json`, `/compare/values/{region}.json`
and `.csv`, `/data/*`). Large tables render their first view at build time and load the rest, and
island props are packed (`packRows` in `src/lib/compare/rows.ts`), to keep pages under about 150 KB.

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
  `--heat-lo`, `--heat-hi`.
* **Navigation** comes from `NAV_ITEMS` and `FOOTER_LINKS` in `src/lib/site.ts`.

## Data sources and citation

Mitochondrial genomes from NCBI RefSeq; lifespan and life-history traits from AnAge.

Toren D, Barzilay T, Tacutu R, Lehmann G, Muradian KK, Fraifeld VE. MitoAge: a database for
comparative analysis of mitochondrial DNA, with a special focus on animal longevity.
*Nucleic Acids Res.* 2016;44(D1):D1262–5. doi:10.1093/nar/gkv1187
