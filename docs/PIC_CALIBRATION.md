# PIC calibration

Whether the phylogenetically independent contrasts (PIC) test behind the correlation table's `pic_r` and
`pic_p_value` is correct, and whether its p values mean what they say. Asked on 2026-11-15 after two
simulated referee panels flagged Supplementary Table S1: in Chondrichthyes, Rajiformes, Clupeiformes,
Actinopterygii and all species the contrast test rejects 35–43% of lifespan tests, far more than the test
across species in the same scopes.

## Answer

- **The code is correct.** It computes the same contrasts as R `ape::pic` (ape 5.8.1, R 4.4.3) and the same
  r and p values to every printed digit, in Chondrichthyes, Mammalia and Rajiformes. There is no bug to fix,
  so this report comes with no code fix and no regression test.
- **The test is calibrated under its own model and not under the data.** When log10 lifespan is replaced by
  Brownian motion simulated on the same dated tree, the test rejects 4.75–5.30% at p < 0.05 in every one of
  the 32 scopes. When log10 lifespan is shuffled across the species of a scope, which breaks any relation to
  the tree and to the feature, it rejects 22–33% in the fish scopes and in all species (29.1%).
- **Why it over-rejects:** in the scopes that over-reject, one pair of sister species carries most of the
  lifespan contrasts' variance. In Chondrichthyes and Rajiformes it is *Dipturus trachyderma* (26 y) against
  *Zearaja nasuta* (9 y), placed about 0.4 Myr apart on the dated tree: that one contrast holds 55% of the
  sum of squared lifespan contrasts in Chondrichthyes and 66% in Rajiformes. In Clupeiformes it is *Alosa
  sapidissima* (13 y) against *A. alabamae* (4 y), with 93%. Any feature that also differs between the two
  sisters gets a large contrast there, and the correlation through the origin is then decided by that one
  node, while the t test counts all 79 (or 18, or 36) contrasts as independent evidence. The median over
  features of the largest single contrast's share of the cross-product is 0.43 in Chondrichthyes, 0.62 in
  Rajiformes, 0.54 in Clupeiformes and 0.42 in Acipenseriformes, against 0.03 in Mammalia.
- **The branch lengths do not standardise the contrasts.** The Garland, Harvey & Ives (1992) diagnostic, the
  correlation between a lifespan contrast's absolute value and its standard deviation, is negative in 30 of 32
  scopes (−0.12 in Mammalia; −0.39 in Chondrichthyes, −0.51 in Rajiformes, −0.60 in Acipenseriformes): short
  branches give contrasts that are too large, which is what Brownian motion on these branch lengths does not
  allow.
- **A test that does not assume equal-variance normal contrasts** (flipping the signs of the lifespan
  contrasts at random, 9,999 times, which keeps every contrast's size and so any node where both traits
  change a lot) rejects 59 of 1,368 tests in Chondrichthyes (4.3%) instead of 585, 4 of 191 in Rajiformes
  instead of 74, and 197 of 1,398 in Mammalia against 224 for the t test. Where the data fit the model the
  two tests agree; where one node dominates they do not.

## How it was checked

All runs from commit `0d67d1e` on `main`, on haumea (`/data/uq2347/runs/mitoage/pic-check/`).

1. **Against ape::pic** (Slurm job 6486181). `bun run pipeline/pic-calibration.ts export` wrote the dated tree
   as Newick, the tip values of six lifespan tests per scope and the site's own contrasts, each keyed by the
   set of species under its node. `ape/compare.R` (below) pruned the tree with `keep.tip`, resolved
   polytomies with `multi2di(random = FALSE)`, ran `pic`, and matched contrasts node by node.
   - Rajiformes (no polytomies): all 19 contrasts per test identical (largest difference 0), r and p
     identical.
   - Chondrichthyes and Mammalia: r and p identical to 7 significant digits (Chondrichthyes `aa:total_pc:V`:
     r = 0.631320, p = 2.6407e-10 from both). Node by node, 6 of 474 matched rows (Chondrichthyes) and 71 of
     3,522 (Mammalia) differ, all at nodes inside a resolved polytomy: the site pairs a polytomy's children in
     tree order, `multi2di` in its own order, and the two give different intermediate contrasts with the same
     sums of squares and cross-products, so r is unchanged. ape's `lm(cy ~ cx - 1)` gives the same p as the
     site's t test with m − 1 degrees of freedom.
   - Not covered by ape: two sister tips both on branches of length 0 make ape divide by zero; the site
     averages them and makes no contrast. None of the 18 tests compared hit that case.
2. **Calibration, every lifespan test of every scope** (Slurm array job 6486136, 32 tasks;
   `pipeline/pic-calibration.sbatch`). For each of the 15,904 lifespan tests of dataset `default`,
   `bun run pipeline/pic-calibration.ts calibrate` recomputed the contrasts (identical to the table in all
   15,904: the run checks), then: 1,000 Brownian-motion lifespans on the dated tree, the same 1,000 per scope
   for every feature; 1,000 shuffles of log10 lifespan across the scope's species; a sign-flip p value from
   9,999 flips; the contrast correlation with log10 adult body mass partialled out (regression through the
   origin on the three traits' contrasts, df = m − 2, on the species with a mass); the Garland diagnostic;
   and the largest single contrast's share of the cross-product. The null replicates call the library's
   `picFast`, the code the site build runs. Seeds are fixed (`PIC_SEED`, default 20261115).
3. The per-test results are in `docs/analyses/pic-calibration/scopes/` (one TSV per scope), the per-scope
   counts in `docs/analyses/pic-calibration/summary.tsv`, the ape comparison in
   `docs/analyses/pic-calibration/ape/`.

## Per scope

Tests: lifespan tests. p, FDR: across species, as in Table S1. PIC: contrast t test, p < 0.05, as published.
BM null, shuffle null: share of null replicates with PIC p < 0.05, averaged over the scope's features.
Sign-flip: tests with sign-flip p < 0.05. PIC + mass: tests whose contrast correlation with body mass
partialled out has p < 0.05 (t test; Bivalvia, Caudata and Scombriformes have too few masses). Top share:
median over features of the largest contrast's share of the cross-product. Garland r: |lifespan contrast|
against its standard deviation (computed per test on that test's species; the table shows the scope's last
test, as the species sets of a scope's tests differ little).

| Scope | Tests | p < 0.05 | FDR | PIC | BM null % | Shuffle null % | Sign-flip | PIC + mass | Top share | Garland r |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| all | 1414 | 1179 | 1168 | 565 | 4.95 | 29.1 | 170 | 180 | 0.05 | -0.21 |
| class:Mammalia | 1398 | 954 | 918 | 224 | 4.98 | 9.1 | 197 | 202 | 0.03 | -0.12 |
| class:Actinopterygii | 1402 | 832 | 769 | 546 | 5.00 | 30.2 | 148 | 141 | 0.08 | -0.33 |
| class:Aves | 1390 | 688 | 590 | 181 | 5.03 | 11.2 | 77 | 191 | 0.06 | -0.34 |
| class:Reptilia | 1403 | 405 | 231 | 94 | 4.99 | 8.8 | 78 | 88 | 0.10 | -0.22 |
| order:Primates | 204 | 128 | 118 | 12 | 4.88 | 6.4 | 14 | 9 | 0.07 | -0.13 |
| class:Bivalvia | 1331 | 111 | 0 | 90 | 5.20 | 7.3 | 73 | 0 | 0.19 | -0.32 |
| order:Artiodactyla | 204 | 92 | 76 | 27 | 4.95 | 7.8 | 16 | 21 | 0.07 | -0.20 |
| order:Perciformes | 205 | 91 | 81 | 12 | 4.98 | 5.3 | 8 | 21 | 0.07 | -0.39 |
| order:Carnivora | 205 | 88 | 72 | 53 | 4.83 | 6.8 | 37 | 57 | 0.09 | -0.22 |
| order:Rodentia | 204 | 77 | 50 | 23 | 5.05 | 8.3 | 17 | 27 | 0.09 | -0.19 |
| order:Passeriformes | 204 | 72 | 41 | 28 | 4.75 | 7.5 | 23 | 27 | 0.09 | -0.36 |
| class:Chondrichthyes | 1368 | 67 | 2 | 585 | 5.13 | 32.7 | 59 | 250 | 0.43 | -0.39 |
| order:Cypriniformes | 200 | 67 | 45 | 14 | 5.10 | 6.9 | 18 | 19 | 0.08 | -0.31 |
| order:Acipenseriformes | 197 | 63 | 43 | 78 | 5.13 | 22.5 | 51 | 17 | 0.42 | -0.60 |
| order:Psittaciformes | 202 | 56 | 35 | 19 | 4.77 | 6.9 | 18 | 10 | 0.15 | -0.39 |
| order:Siluriformes | 197 | 56 | 16 | 23 | 4.90 | 8.3 | 25 | 10 | 0.20 | -0.02 |
| order:Pleuronectiformes | 203 | 53 | 11 | 10 | 4.90 | 4.2 | 15 | 12 | 0.20 | -0.44 |
| order:Cetacea | 198 | 52 | 12 | 6 | 5.12 | 6.5 | 11 | 3 | 0.17 | 0.13 |
| order:Charadriiformes | 199 | 44 | 21 | 3 | 4.93 | 8.1 | 13 | 10 | 0.14 | -0.27 |
| order:Centrarchiformes | 198 | 41 | 0 | 15 | 5.17 | 7.4 | 7 | 7 | 0.24 | 0.06 |
| class:Amphibia | 1386 | 37 | 0 | 146 | 4.97 | 10.6 | 54 | 118 | 0.21 | -0.30 |
| order:Squamata | 205 | 26 | 0 | 6 | 5.30 | 6.4 | 13 | 8 | 0.11 | -0.22 |
| order:Salmoniformes | 194 | 23 | 0 | 15 | 5.08 | 5.9 | 9 | 11 | 0.20 | -0.52 |
| order:Anseriformes | 193 | 21 | 0 | 11 | 4.98 | 5.8 | 11 | 13 | 0.26 | -0.44 |
| order:Scombriformes | 201 | 21 | 0 | 13 | 5.11 | 5.2 | 17 | 0 | 0.21 | -0.18 |
| order:Chiroptera | 202 | 20 | 0 | 26 | 4.95 | 5.8 | 25 | 15 | 0.15 | -0.34 |
| order:Carcharhiniformes | 197 | 19 | 0 | 12 | 4.98 | 5.7 | 8 | 9 | 0.18 | -0.22 |
| order:Clupeiformes | 200 | 19 | 0 | 70 | 5.08 | 24.8 | 21 | 13 | 0.54 | -0.32 |
| order:Caudata | 204 | 14 | 0 | 16 | 5.15 | 7.2 | 14 | 0 | 0.24 | -0.22 |
| order:Testudines | 205 | 13 | 0 | 11 | 4.98 | 7.5 | 4 | 12 | 0.20 | -0.22 |
| order:Rajiformes | 191 | 10 | 0 | 74 | 5.18 | 23.9 | 4 | 3 | 0.62 | -0.51 |
| **All scopes (32)** | **15,904** | **5,439** | **4,299** | **3,008** | | | **1,255** | **1,504** | | |

The Brownian-motion column is the check of the code: 4.75–5.30% everywhere, as a correct implementation
must give (conditional on a feature's contrasts, Brownian lifespan contrasts are independent normals of
equal variance, so the t test is exact whatever the feature looks like). The shuffle column is the most
extreme departure from the model: lifespan with no phylogenetic structure at all. The fish scopes whose
observed PIC rate is 35–43% reject 22–33% under that null.

## Which manuscript numbers would change

None changes because of a bug. They change only if the authors replace the contrast t test by a test that
survives the heavy tails. With the sign-flip p value in place of `pic_p_value`, recomputed from these runs
(`docs/manuscript/mitoage2.md` was not edited):

| Number | Now | With the sign-flip test |
| --- | --- | --- |
| Table 3 / S1, PIC column, all 32 scopes | 3,008 | 1,255 |
| Both (FDR and PIC, same sign); abstract, Results, Figure 1 | 896 of 4,299 | 531 of 4,299 |
| All three (Both and the partial correlation on mass) | 547 | 336 |
| All species: FDR-passing, PIC-significant with the opposite sign | 205 | 50 |
| All 32 scopes: the same, summed | 360 | 72 |
| Chondrichthyes, PIC | 585 of 1,368 (42.8%) | 59 (4.3%) |
| Rajiformes, PIC | 74 of 191 (38.7%) | 4 (2.1%) |
| Clupeiformes, PIC | 70 of 200 (35.0%) | 21 (10.5%) |
| Actinopterygii, PIC | 546 of 1,402 (38.9%) | 148 (10.6%) |
| All species, PIC | 565 of 1,414 (40.0%) | 170 (12.0%) |
| Mammalia, PIC; Both | 224; 164 | 197; 153 |

Per scope, the Both column under the sign-flip test is in `summary.tsv` (`both_signflip`). NOTES.md Q5's
"18.9% of the lifespan tests have PIC p < 0.05" becomes 7.9% (1,255 of 15,904).

The sign-flip test was not itself put through the simulations above; it is exact under independent,
symmetric contrasts of any sizes, which is a weaker assumption than the t test's but still an assumption.

## Body mass: corrected, uncorrected, or both

The table has no single test that controls for both ancestry and body mass. `pic_r` controls for ancestry
and not for mass; `partial_r` controls for mass and not for ancestry; "All three" asks both of them to agree.
The new `mass_r` column of the calibration TSVs is the contrast correlation with mass partialled out, on the
species that have a mass. Among the 4,299 FDR-passing correlations, 393 are significant on it with the same
sign (281 also pass the partial correlation across species), against 896 for the contrast test without mass.
It uses the same t test and inherits the same heavy-tail problem in the fish scopes.

Lifespan and body mass are strongly correlated across animals, so "does this feature track lifespan" and
"does it track lifespan beyond body size" are different questions, and readers in ageing research will ask
both. Reporting both, side by side, is the honest option; reporting only the mass-corrected one would hide
that most of the signal is shared with size, and only the uncorrected one would overstate what is specific
to lifespan. That is a decision for the authors.

**Decided (D11, 2026-11-15): both, side by side.** The site build writes `pic_mass_r` and `pic_mass_p_value`
for every lifespan row (at least 10 species with a weight, as for `partial_r`), and Table 3 has a column "PIC +
mass": 393 of 4,299 in `default`, the cluster run's count; the values agree with `mass_r` and `mass_p` above to
the printed precision in all 11,946 rows both compute (the cluster run also filled 3,958 rows of scopes with 4
to 9 masses, none of which passes).

## What could be done

**Decided (D10, 2026-11-15):** the maintainer keeps the t test and the published counts ("we should not
overdrop tings"). The options below stay on file; each would change published numbers.

1. Report the sign-flip p value next to, or instead of, `pic_p_value`. **Done, next to it:** the site
   build writes `pic_signflip_p` into `correlations.parquet` for every lifespan row (trait
   `maxLongevityYears`, both datasets), from `signFlipPValue` in `pipeline/lib/stats.ts`: up to 9,999 flips,
   stopping once 100 flips are at least as extreme (Besag & Clifford 1991), seeded by dataset, scope, trait
   and feature. Over the 15,904 lifespan tests of `default` it gives 1,253 below 0.05, against 1,255 from the
   cluster run's fixed 9,999 flips above, and 533 "Both" against 531: the difference is Monte Carlo noise at
   the boundary. In `anage_only`: 1,017 of 13,380, and 502 "Both" against 659 for the t test. The site build
   takes about 40 s longer. Other traits
   get no value (null), as for `partial_r`, because flipping every trait would add minutes to each build.
2. Flag or drop contrasts whose standardised value is an outlier (|studentised residual| > 3, Jones & Purvis
   1997), and check the dominating sister pairs (*Dipturus trachyderma* / *Zearaja nasuta*; *Alosa
   sapidissima* / *A. alabamae*) for a lifespan error or a misdated split.
3. Transform the branch lengths until the Garland diagnostic is flat, or fit Pagel's lambda (PGLS), as
   NOTES.md Q5 (d) already proposes.
4. Record `pic_n` and `pic_df` in the correlation table (NOTES.md Q5 (c)).

## Rerun

On haumea, from a checkout pulled from `main`:

```sh
mkdir -p out/pic-calibration/logs && sbatch --array=1-32 pipeline/pic-calibration.sbatch
```

The ape comparison needs R with ape (`micromamba create -n mitoage-r -c conda-forge r-base=4.4 r-ape`); the R
script is not in the repository (TypeScript only), so it is reproduced here. Its inputs come from
`bun run pipeline/pic-calibration.ts export <dir> <scope> aa:total_pc:V codon:total_pc:CAA codon:total_pc:AAG gcSkew:ND2 gc:CYTB ff:total_pc:A`,
then `Rscript compare.R <dir>`.

```r
# Recompute MitoAge contrasts with ape::pic and compare, node by node, with the site build (picFast).
suppressMessages(library(ape))
dir <- commandArgs(TRUE)[1]
tree <- read.tree(file.path(dir, "tree.nwk"))
tips <- read.delim(file.path(dir, "tips.tsv"))
ours <- read.delim(file.path(dir, "contrasts_ours.tsv"), colClasses = c(key = "character"))
tests <- read.delim(file.path(dir, "tests_ours.tsv"))
fmt <- function(v) sprintf("%.0f", v)
summ <- list(); nodes <- list()
for (f in unique(tips$feature)) {
  d <- tips[tips$feature == f, ]
  d <- d[paste0("s", d$species_id) %in% tree$tip.label, ]
  lab <- paste0("s", d$species_id)
  tr <- keep.tip(tree, lab)
  polytomies <- tr$Nnode < Ntip(tr) - 1
  if (polytomies) tr <- multi2di(tr, random = FALSE)
  x <- setNames(d$x, lab); y <- setNames(d$y, lab)
  cx <- pic(x, tr, var.contrasts = TRUE); cy <- pic(y, tr)
  ok <- is.finite(cx[, 1]) & is.finite(cy)
  m <- sum(ok)
  r <- sum(cx[ok, 1] * cy[ok]) / sqrt(sum(cx[ok, 1]^2) * sum(cy[ok]^2))
  p <- 2 * pt(-abs(r * sqrt((m - 1) / (1 - r^2))), m - 1)
  p_lm <- summary(lm(cy[ok] ~ cx[ok, 1] - 1))$coefficients[1, 4]
  ids <- as.numeric(sub("^s", "", tr$tip.label))
  keys <- sapply(prop.part(tr), function(s) { v <- ids[s]; paste(length(v), fmt(sum(v)), fmt(min(v)), fmt(max(v)), sep = ":") })
  a <- data.frame(key = keys, acx = cx[, 1], acy = cy, av = cx[, 2])
  o <- ours[ours$feature == f, ]
  j <- merge(o, a, by = "key")
  j <- j[is.finite(j$acx) & is.finite(j$acy), ]
  dev <- with(j, c(max(abs(abs(cx) - abs(acx))), max(abs(abs(cy) - abs(acy))), max(abs(cx * cy - acx * acy)), max(abs(v - av))))
  t <- tests[tests$feature == f, ]
  summ[[f]] <- data.frame(feature = f, tips = length(lab), polytomies_resolved = polytomies,
    m_ape_finite = m, m_ape_nonfinite = sum(!ok), m_ours = nrow(o), matched_nodes = nrow(j),
    r_ape = r, r_ours = t$pic_r, p_ape = p, p_ape_lm = p_lm, p_ours = t$pic_p_value,
    max_dev_abs_cx = dev[1], max_dev_abs_cy = dev[2], max_dev_product = dev[3], max_dev_var = dev[4])
  nodes[[f]] <- cbind(feature = f, j)
}
s <- do.call(rbind, summ)
write.table(s, file.path(dir, "ape_vs_ours.tsv"), sep = "\t", quote = FALSE, row.names = FALSE)
write.table(do.call(rbind, nodes), file.path(dir, "ape_vs_ours_nodes.tsv"), sep = "\t", quote = FALSE, row.names = FALSE)
cat(R.version.string, " ape ", as.character(packageVersion("ape")), "\n", sep = "")
print(s, digits = 6)
```
