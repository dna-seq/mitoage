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
| `bun test` | Pipeline unit tests |

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
    ui/            Header, Footer, Hero, Card, StatCard, Button, Chip, Breadcrumb, TabNav,
                   CompositionBar, DataTable, SearchBox, CodonHeatmap, LinearGenomeTrack
    charts/        Scatter (reusable scatter-plot island)
  lib/             URL helpers, formatting, class colours, genetic codes, JSON-LD builders
  pages/           routes
```

Pages read data only through `~/data` (`src/data/index.ts`), which is server-side. Islands receive
data as props or fetch static JSON emitted at build time (`/search-index.json`,
`/species/gc-lifespan.json`, `/data/*`).

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
