# MitoAge next-generation site: scaffold, data pipeline and design foundation in progress

**Date:** 2026-11-12
**Status:** IN PROGRESS
**Bead(s):** none
**Epic:** MitoAge next generation (repo `dna-seq/mitoage`, README title "mito-age-next")
**Chain:** `standalone-8fbb5cc2` seq `1`
**Parent:** `none — first in chain`
**Prior chain:** none — first in chain

---

## The Goal

Rebuild the MitoAge database website (https://www.mitoage.info/, paper: Toren et al., Nucleic Acids Res. 2016;44(D1):D1262–5) as a new-generation site: new design, new functionality, responsive on desktop and phone, and easy for search engines to index. The look must follow the "Trust me, I'm a Biologist" brand (green gradients, low-poly texture, constellation of dots, round badge), and the owner is strict about visual quality. New functionality agreed so far: a proper taxonomy visual component, genes shown on a real circular mitochondrial genome map, life-history traits from AnAge (and later other sources) correlated with mtDNA features such as GC content, and open Parquet downloads. The owner wants to see a running site as soon as possible.

## Where We Are

- Repo `/home/antonkulaga/sources/mitoage`, branch `main`, remote `git@github.com:dna-seq/mitoage.git`. Last pushed commit `7efa43c` ("WIP: data pipeline and design foundation (agents still running)"), 100 files, 12,195 insertions.
- Stack chosen and scaffolded: Astro 7.4.11 (static output, `trailingSlash: "always"`, `site: https://www.mitoage.info`), `@astrojs/solid-js` 7.1.5, `solid-js` 1.9.19, `@astrojs/sitemap`, `d3` 7.9.2, `hyparquet` + `hyparquet-writer`, Bun 1.4.2, TypeScript 7 with `astro/tsconfigs/strictest`. Scripts in `package.json`: `dev`, `build`, `preview`, `check`, `data` (`bun run pipeline/build.ts`).
- `src/data/schema.ts` is the data contract (types `Species`, `Traits`, `RegionStats`, `CodonUsage`, `GenomeFeature`, `TaxonNode`, `FeatureDef`, `Correlation`, `BuildInfo`, and the `DataApi` interface). The pipeline agent modified it after I wrote it (it reported adding optional fields such as `RegionStats.source` and `Correlation.partialR`); read the current file, do not assume my original.
- `src/data/index.ts` exists and exports every `DataApi` function: `getBuildInfo`, `getAllSpecies`, `getSpeciesBySlug`, `getSpeciesById`, `getTaxonomyTree`, `getTaxa`, `getTaxon`, `getSpeciesInTaxon`, `getRegionStats`, `getRegionStatsForRegion`, `getCodonUsage`, `getGenomeFeatures`, `getFeatureDefs`, `getFeatureValues`, `getCorrelations` (plus a default `api` export and `export * from "./schema"`).
- Generated data is committed: `src/data/generated/` (species.json 588 KB, taxonomy.json 207 KB, region-stats.json 1.0 MB, codon-usage.json 2.7 MB, genome-features.json 619 KB, feature-defs.json 137 KB, feature-values.json 6.1 MB, correlations.json 5.0 MB, build-info.json 7 KB).
- Downloads are committed: `public/data/` (species.parquet 111 KB, species.csv 229 KB, region_stats.parquet 485 KB, codon_usage.parquet 924 KB, genome_features.parquet 204 KB, correlations.parquet 2.45 MB, explorer.json 1.07 MB, README.md).
- Pipeline code: `pipeline/build.ts`, `pipeline/validate.ts`, `pipeline/lib/{cache,csv,genbank,genetic-code,names,stats,zip}.ts`, `pipeline/sources/{anage,legacy,mitoage,ncbi,tree}.ts`, `pipeline/steps/{correlations,features,genome,output,readme,regions,taxonomy}.ts`, `pipeline/tests/{names,stats}.test.ts`. Download cache in `data/cache` (43 MB, gitignored).
- Design foundation written by the design agent: `src/styles/{tokens,global}.css`, `src/layouts/`, `src/components/brand/{BadgeLogo,LogoIcon,Mitochondrion}.astro` (+ `mitoGeometry.ts`, `mitoSvg.ts`, `ids.ts`), `src/components/ui/{Header,Footer,Hero,HeroBackdrop,Card,StatCard,Button,Chip,Breadcrumb,TabNav,SectionHeader,ThemeToggle,Icon,CompositionBar,LinearGenomeTrack}.astro`, `src/components/ui/{DataTable,SearchBox,CodonHeatmap}.tsx`, `src/components/charts/Scatter.tsx`.
- Pages written: `src/pages/index.astro`, `about.astro`, `data.astro`, `404.astro`, `search-index.json.ts`, `species/index.astro`, `species/[slug].astro`, `species/[slug].csv.ts`, `species/[slug].json.ts`, `species/gc-lifespan.json.ts`, `view/[id]` (legacy redirects).
- **NOT VERIFIED:** I never ran `bun run build`, `bun run check` or looked at the site. Both Opus agents were still running in the background when the owner left for a train, and I never received their final reports. They die if the machine sleeps. Treat everything under `src/` (except `schema.ts`) and `pipeline/` as unreviewed agent output.
- Wave 2 has not started: no `src/pages/tree/`, `taxa/`, `genes/`, `explore/`, `compare/`, no `src/components/genome/`.
- A design mockup canvas exists (3 artboards: home, species page, phone): https://claude.ai/artifact/GeUZg8qCDqJMbEeRz4iHTt. Source files are in a session scratchpad that may not survive: `/tmp/claude-1001/-home-antonkulaga--claude-spares-spare-diRxzT/2f39a55b-dda4-4260-96d3-c0aea40e52e4/scratchpad/mitoage-design/project/{Main,Species,Phone}.dc.html`. The artifact link is the durable copy.
- Raw input CSVs live in `data/input/mitoage_build1_full_database/` (34 files, 14 MB) and are gitignored by `data/input/.gitignore` (`*` except itself). The pipeline cannot run on a fresh clone without them.
- Codex CLI is installed (`/home/antonkulaga/.local/bin/codex`, codex-cli 0.165.0). The owner suggested using it to generate pictures (logo mitochondria, design variants). Not run yet; I asked for a go-ahead because it sends prompts to OpenAI and got no explicit answer.

## What We Tried (Chronological)

1. **Surveyed inputs.** `data/input` holds 34 CSVs: `<region>_base_composition.csv` for 7 aggregate regions and 13 genes, `<gene>_codon_usage.csv` for 13 genes + `total_pc`. 923 rows in `total_mtDNA` vs 922 in the paper. Class counts: Mammalia 390, Actinopterygii 206, Aves 153, Reptilia 94, Chondrichthyes 35, Amphibia 29.
2. **Reviewed the old site and paper via a web-fetch subagent.** URL shapes: `/view/{id}/species/`, `/browse/{taxId}/{class|order|family}/`, `/stats-for/{gene}/gene/`, `/export-section/{region}/for-all-species/`. Weaknesses: frozen at build 1 (2015), pooled correlations without multiple-testing correction, tables only (no plots), a leaked error string on species pages.
3. **Proposed Astro + Solid islands on Bun, static hosting.** Owner asked what Astro is and insisted on native TypeScript; accepted after explanation. Liked Parquet.
4. **First design sketch as an inline chat widget (flat, generic).** Rejected harshly: "ugly shit". The owner sent a photo of the real banner and pointed at its gradients and richness.
5. **Second design as a Design canvas artifact** in the banner style (yellow/orange top band with lab illustrations, green-to-lime gradient hero with low-poly and constellation, round badge). Feedback: the orange/yellow band wastes space and is optional; the mitochondrion "looks like a bean rather than something real".
6. **Third iteration:** slim dark-green header (`#0E4A22`) with a thin orange underline, orange feature strip removed, mitochondrion redrawn as a capsule with double membrane, eight cristae, mtDNA rings and ribosome dots. Owner then said "so far the plan looks good, I want to see how it looks" and asked for a fleet of Opus agents.
7. **Scaffolded by hand** (`bun init`, `bun add`, wrote `astro.config.ts`, `tsconfig.json`, `src/data/schema.ts`). Removed the `CLAUDE.md` that `bun init` generates, because it tells agents to avoid Vite, which Astro uses.
8. **Launched wave 1: two Opus agents in parallel with disjoint file ownership** (pipeline vs design/pages). Owner asked for an intermediate commit before the tree work; committed scaffold as `55b20a5`, then a WIP snapshot as `7efa43c` when the owner had to leave.

## Key Decisions

- **Astro + Solid islands, not a pure Solid SPA or SolidStart.** Reason: ~1,500 read-mostly pages need complete HTML for indexing; islands keep scripts small on phones. Rejected: plain Bun + SolidJS SPA (empty shell for crawlers), SolidStart (more script per page), SvelteKit.
- **Fully static, no backend.** The dataset is tiny (922 species). All statistics are computed at build time or in the browser. Owner did not object; not explicitly confirmed.
- **Parquet for downloads and browser explorer, JSON for build-time loading.** Owner explicitly liked Parquet.
- **Everything in TypeScript, including the pipeline** (owner: "I want to code in typescript natively without ugly js"). No Python in the repo.
- **Data contract first, then parallel agents with strict directory ownership**, so agents do not collide. No agent commits; the main session commits.
- **Species ids stay the MitoAge-era HAGRIDs**; AnAge build 15 renumbered ids, so traits are joined on scientific name (pipeline agent's finding and decision).
- **Original logo art only.** The Rosie sticker is third-party artwork and must not be reused; the badge uses an original mitochondrion.
- **Defaults I chose without explicit confirmation:** AnAge as the only trait source for v1; radial tree (icicle on phones) as the taxonomy browser; corrected statistics as headline with the paper's Pearson values as a reference view.

## Evidence & Data

Commits on `main`:

| Hash | Summary |
|---|---|
| `0bbe968` | Initial commit |
| `55b20a5` | Scaffold Astro + SolidJS site on Bun with typed data contract |
| `7efa43c` | WIP: data pipeline and design foundation (agents still running) |

Findings recorded by the pipeline in `src/data/generated/build-info.json` (`notes`):

- **923 vs 922:** the extra CSV row is *Loxioides bailleui* (HAGRID 1598, NC_025626.1), whose RefSeq record is only 9,243 bp. Excluded; build has 922 species.
- **Base-label bug confirmed:** every CSV has complement-labelled base columns ("G" holds C, "C" holds G, "A" holds T, "T" holds A). Human NC_012920.1: CSV G=5181, C=2169, A=4094, T=5124; real rCRS A=5124, C=5181, G=2169, T=4094. Holds for 922/922 species in `total_mtDNA`. Output is corrected to the RefSeq strand. GC% is unaffected.
- **Recompute agreement:** label-fixed CSV counts match recomputation from RefSeq for 17,677/18,030 species-region pairs (98.0%); 0 match with original labels. Worst regions: total_pc 769/919, ND3 797/919 (annotation updates since 2015).
- **Codons:** CSV codon counts are correctly labelled; recount reproduces 11,894/11,941 gene rows (99.6%).
- **AnAge:** build 15 (2023-07-03); 896 species matched by scientific name, 26 by common name after renaming, 0 unmatched. 59 species now have a different maximum longevity in AnAge; the build keeps the 2015 values.
- **GenBank features:** 922 species fetched; 912 have at least 13 CDS, 2 rRNA and 22 tRNA. D-loop computed from sequence for 263 species missing it in the CSV.
- **Duplicates:** 16S rows duplicated for HAGRID 2497, 3897, 4026; resolved against RefSeq.
- **Phylogeny skipped** (`MITOAGE_SKIP_TREE`): no branch lengths, no PIC in this build.
- **Correlations:** Pearson, Spearman, two-tailed p, BH q within (trait, scope); 18 scopes (all, classes and orders with n ≥ 20); `partialR` controls for log10 adult weight.

My own early check (before the pipeline): pooled Pearson r of whole-genome GC% vs log10 max lifespan across 923 rows = 0.044; lifespan range 0.16–507 yr; GC% range 15.14–50.64.

Design tokens used in the mockup: greens `#156F31 #1F8A3B #2E9A3C #55B336 #B9DC35`, deep green `#0E4A22`, page tint `#F4FAE6`, navy text `#17305C`, muted `#4A5A78`, red action `#E8503A → #C62F22`, orange accent `#F7A81B`, sky `#5BB3E6`, violet `#9A6BD8`; font Nunito.

## Code Analysis

- `src/data/schema.ts`: regions are `PROTEIN_GENES` (13) + `AGGREGATE_REGIONS` (`total_mtDNA`, `total_pc`, `total_rRNA`, `total_tRNA`, `rRNA-12S`, `rRNA-16S`, `D_Loop`). Feature keys look like `gc:total_mtDNA`, `gcSkew:ND6`, `codon:total_pc:CUA`.
- `GenomeFeature` coordinates are 1-based inclusive; `start > end` means the feature wraps the origin. Leucine and serine tRNAs are named by codon family (`tRNA-Leu(UUR)` etc.).
- `src/data/index.ts` is synchronous and memoised; designed for Astro frontmatter and `getStaticPaths`.
- The species page was specified to leave a slot for a `<GenomeMap>` island; `LinearGenomeTrack.astro` exists as a stopgap from the design agent.
- Planned route ownership for wave 2: `src/pages/tree/**` + `src/pages/taxa/**` (taxonomy), `src/pages/genes/**` + `src/components/genome/**` (genome map), `src/pages/explore/**` + `src/pages/compare/**` (explorer).

## Files Changed

### Config
- `package.json`, `bun.lock`, `tsconfig.json`, `astro.config.ts`, `.gitignore` (added `.astro`, `data/cache`)

### Source code
- `src/data/schema.ts`, `src/data/index.ts`
- `src/styles/**`, `src/layouts/**`, `src/lib/**`, `src/components/{brand,ui,charts}/**`, `src/pages/**`
- `pipeline/**`

### Data & results
- `src/data/generated/*.json`, `public/data/*`

### Not in the repo
- Design canvas artifact (link above); raw CSVs (gitignored); `data/cache` (gitignored)

## User Feedback & Preferences (REQUIRED — never omit)

- Wants "trustmeiambiologist" style: the real banner's gradients and richness. Flat generic design was called "ugly shit". Show polished visuals, not wireframes.
- The big orange/yellow band wastes space; treat orange as optional accent only.
- The logo mitochondrion must look like a real mitochondrion, not a bean.
- Wants native TypeScript everywhere, "without ugly js".
- Likes Parquet.
- Wants taxonomy as a proper visual component, genes shown on a real mitochondrial genome, and life-history traits (AnAge and other projects) correlated with GC content.
- Suggested using Codex to generate pictures: design variants and mitochondria for the logo.
- Asked for a fleet of Opus 5.5 agents for the initial implementation; wants to see the result quickly.
- Asked to commit intermediate results before starting the tree UI elements.
- Global instruction (`~/.claude/CLAUDE.md`): commit and push to `main` without asking when a task changes files; no pull requests; never force-push.
- Asked for the artifact URL directly ("give url"); prefers short, direct answers.

## Where We're Going

1. Check whether the two wave-1 agents finished. Run `bun run data` (needs raw CSVs + cache), `bun run check`, `bun run build`; fix errors.
2. Start the preview server and look at home, species index and a species page at 375 px and 1280 px, light and dark. Fix what looks wrong against the mockup and the owner's feedback. Show the owner.
3. Commit and push the verified wave-1 state.
4. Wave 2, three parallel agents with disjoint ownership: taxonomy tree component + taxon pages; circular genome map + gene pages; plot explorer + compare.
5. Integrate, build, view, commit and push.
6. If the owner confirms, run Codex for illustrated logo options and design variants.
7. Later: dated phylogeny (TimeTree / Open Tree of Life) for PIC; extra trait sources (PanTHERIA, Amniote database, AVONET, FishBase); deployment and redirects from old URLs.

## Risks & Blockers

- Wave-1 output is unverified and may be half-written if the agents were killed mid-edit.
- Raw CSVs are not in git, so the pipeline cannot rerun on another machine; generated JSON is committed, so the site build should not need them.
- `feature-values.json` (6.1 MB) and `correlations.json` (5.0 MB) are committed; watch repo growth if the pipeline is rerun often.
- Astro 7 and TypeScript 7 are newer than most documentation examples; check installed types before assuming APIs.

## Open Questions

- Hosting target: GitHub Pages, Cloudflare Pages, or the existing mitoage.info server?
- Should the site show the 2015 maximum longevity values or AnAge build 15 values (59 species differ)?
- Tree form: radial tree vs conventional collapsible tree?
- Is dark mode wanted in v1?
- Does the owner have an existing MitoAge logo to keep, or is the new badge the logo?

## Quick Start for Next Session

```bash
cd /home/antonkulaga/sources/mitoage
git pull && git log --oneline -5 && git status -s

# Key files to read first
#   src/data/schema.ts
#   src/data/index.ts
#   src/data/generated/build-info.json   (data findings)
#   src/styles/tokens.css
#   src/pages/index.astro, src/pages/species/[slug].astro

# Verify current state
bun install
bun run check
bun run build
bun run preview

# Design reference
#   https://claude.ai/artifact/GeUZg8qCDqJMbEeRz4iHTt

# Next action
#   Get `bun run build` green, look at the pages in a browser, fix, then show the owner.
```

## Session Closed
**Closed at:** 2026-11-12 (afternoon, owner leaving for a train)
**Commit:** the `session: mitoage-next-site` commit that includes this note
**Session status:** Handed off to next session
