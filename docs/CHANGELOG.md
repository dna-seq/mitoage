# Changelog

Newest first.

## Unreleased

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
