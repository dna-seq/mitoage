# MitoAge 2 manuscript: notes for the authors

Companion to `mitoage2.md` (draft 0.1, 2026-11-14). It says where every number in the draft comes from
and lists the questions only the authors can answer.

## How the draft is built

- **Model.** The 2016 paper (Toren et al., NAR 44:D1262) is a short Database-issue article: Introduction,
  Database content and interface, Data sources and curation, Data calculation, Availability, Conclusion.
  The draft keeps its voice and its opening references (numbered as in 2016 so the two lists can be
  compared), and adds a Materials and methods section, because what is new in build 2 is mostly method:
  pinned sources, re-verification, a dated tree, three controls, two reproductions.
- **The story.** One argument runs through it: the sources drift, the 2016 correlations were counted
  without controls for shared ancestry, and most do not survive one; what survives is concentrated in the
  strand asymmetry and the codon usage it shapes. The abstract, the Results and the Conclusion all carry
  that argument; the website is described after it, not before.
- **Claim ceiling.** The draft does not claim that any mtDNA feature causes or predicts lifespan. The
  codon finding is phrased as "the direction expected from" the heavy-strand A>G signature, not as
  evidence for it.

## Where the numbers come from

Every number is from `dna-seq/mitoage` at commit 84ba6f7 (origin/main, 2026-11-14), build 2 of 2026-11-13.

| Numbers | Source |
|---|---|
| 2,335 species, 1,413 new, record statuses (392 / 465 / 46 / 19), retired reasons, 18 successors, 2 new versions, 884 unchanged accessions | `docs/BUILD2_REPORT.md`, Summary and "Species by record status"; `public/data/species.parquet` |
| Live species per taxon (Table 1), 23 classes, 9 phyla, 35 bivalves / 30 malacostracans / 11 cephalopods | computed from `public/data/species.parquet` (`record_status != retired`), grouped as in 2016 Table 1 |
| Lifespan sources of new species (838 / 475 / 74 / 26) | `docs/BUILD2_REPORT.md`, "New species: class x lifespan source" |
| Changelog 14,392 rows by type | `docs/BUILD2_REPORT.md`, "Changelog rows: table x change_type" |
| 59 revised AnAge lifespans + *Andrias davidianus* | build-2 verification audit (`data/cache/build2/verification/verification_summary.md`) and the report's retired list |
| 320 regions missing from release 1, 263 D-loops | build-1 processing notes (`public/data/README.md` of build 1) and the audit ("gap fill: 320 rows") |
| Human rCRS base counts, release 1 vs deposited | `public/data/README.md`, data notes |
| 16,008 complete metazoan mitogenomes from 15,876 species, 14,970 species not in release 1 | `data/cache/build2/candidates/build2_candidates_summary.md` |
| Tree: 2,305 of 2,335 placed, 2,045 of 2,229 nodes dated, 184 interpolated, 61 raised | `public/data/README.md`, data notes |
| Datasets 2,202 / 1,710; agreement r = 0.975 | `docs/BUILD2_REPORT.md`, "Correlation datasets" and "Agreement between the datasets" |
| 192 tests, cross-check (1,413 = 1,413; 99.0% of 3,325 keys) | `docs/BUILD2_REPORT.md`, "Commands" and "Cross-check with the audit" |
| Table 3, the funnel (13,947 / 4,851 / 3,854 / 2,577 / 770 / 472), AnAge-only (3,568 / 559), every r and p in "What the controls change" | `dist/data/correlations.parquet` written by `bun run build` in a worktree at 84ba6f7 (2026-11-14), trait `maxLongevityYears`, dataset `default`; the counts were made in an analysis session, not by the pipeline |
| Codon third-position pattern (8 U-ending down, 8 C-ending up) | same file: scope `all`, features `codon:total_pc:*` with q < 0.05, PIC p < 0.05 with the same sign, and partial p < 0.05 |
| Example (threonine, cysteine, methionine, the site screen) | `dna-seq/mitoage-pipelines` at da0c112: `aa_pgls.<Class>.tsv` from `mitoage longevity aa-pgls` (H1, method `pgls`, model `mass+composition`; the mixed-model count from method `mixed`), H2 from `pgls.Mammalia.tsv`; `docs/HYPOTHESES.md` |
| Reproduction: all 5,302,404 values of the seven tables, the 28 alignment files and the dated tree come out identical | `dna-seq/mitoage-pipelines`, `docs/BUILD2_REPRODUCTION.md` at 3550281 (origin/main), "How far it reproduces" |
| 418 of the 472 "All three" keep the sign of the correlation across species in the partial correlation (54 reverse); the partial is positive for UGG and GGG | `dist/data/correlations.parquet` as above: `sign(partial_r) == sign(pearson_r)` among the "All three" rows |
| Partial-correlation sample 1,384 of 2,202 (235 of 827 ray-finned fishes); whole-genome GC within classes, r and partial r (Mammalia 0.47 / 0.40, Actinopterygii 0.034 / −0.14 with p = 0.04, Aves 0.048 / 0.05, Reptilia 0.006 / −0.01) | same file: `partial_n`, feature `gc:total_mtDNA`, scope `all` and the class scopes |
| Survivors by feature: codons are 62% of the tests and 63% of the 472; in all species 27 of 40 skew, 11 of 16 GC-content and 138 of 744 codon correlations that pass the false discovery rate pass all three controls | same file, the funnel grouped by feature family |
| Exclusions behind 2,202: 49 estimated and 65 questionable lifespans | computed from `public/data/species.parquet` (live species, lifespan quality and method) |
| 106 invertebrates: 104 non-chordates, a lancelet and an ascidian | computed from `public/data/species.parquet` (live species by phylum and subphylum) |
| Cross-check: 8,733 changelog rows compared for the original species, 3,325 in both, 5,394 of the other 5,408 `refseq_successor` | `docs/BUILD2_CROSSCHECK.md`, the comparison table and the successor counts |

Definitions used for Table 3: "FDR" is `q_value < 0.05`; "PIC" is `pic_p_value < 0.05`; "Both" adds
`sign(pearson_r) == sign(pic_r)` to both; "All three" adds `partial_p_value < 0.05`. The repository rule
"a number shown on the site is one the pipeline computed" does not cover these counts. If the paper
keeps Table 3, the pipeline's report should emit it, so the manuscript can cite the report instead.


### Repeats, motifs and the rate of evolution (added 2026-11-14)

Every number in this subsection comes from mitoage-pipelines at 6149fa1, run on build 2's species table,
the dated tree and the quality filter, with the motif features from the site pipeline's `mtdna-features`
branch at 5f526c9.

| Number in the draft | Where it comes from |
| --- | --- |
| Inverted repeats, mammals, r = −0.40 (p = 4 × 10⁻¹⁶), n = 383 | `motif_pgls.tsv`, class Mammalia, feature `inverted_repeats_total`, `spearman_rho`/`spearman_p` |
| the same over the major arc, −0.37, n = 334 | same table, `inverted_repeats_major_arc` |
| p = 0.21 and p = 0.93 after the controls | same rows, column `p` (phylogenetic GLS with body mass and fourfold composition, Pagel's λ) |
| 131 tests in four classes, one passes | `motif_pgls.tsv` row count and `q < 0.05` |
| G-quadruplex motifs in 73 reptiles, q = 0.03 | same table, class Reptilia, `g4_forward_total`, q = 0.0266 |
| contact-zone inverted pairs, mammals, r = −0.17 (p = 9 × 10⁻⁴), p = 0.41 after controls | same table, `contact_zone_inverted_pairs` |
| 339 sister pairs | `rate_contrasts.tsv`, rows with `gene == CONCAT` |
| mammals p = 0.02, q = 0.15 | `rates.tsv`, class Mammalia, gene CONCAT, normalisation `dS_mass_adj`, `includes_saturated` false |
| four of 655 single-gene tests pass and disagree in sign | `rates.tsv`: 655 rows, 4 with q < 0.05 (ND6 all species −0.219; Mammalia ND5 +0.220; Aves CYTB −0.021; Mammalia ND2 dN −0.017) |
| one record states a sequencing technology; 1,773 name a source INSDC accession | `assembly_provenance.tsv` from the haumea run of 2026-11-14 (`/data/uq2347/runs/mitoage/gaps/motifs/`), columns `sequencing_technology` and `source_insdc` |

**A result that was withdrawn.** An exploratory Python run of the same screen, over 2,311 species and with
tandem-repeat counts that did not reject units built from a shorter period, gave mammalian G-quadruplexes at
q = 0.048 over 601 species. On the database's own features and the default dataset that result is gone
(q = 0.66, 383 species) and the surviving test is in another class. The draft reports the second run; the
first is recorded here so the change is visible.

**Coverage.** The motif features reach 922 of the build's 2,335 species, because `mtdna-features` branched
before build 2. Classes are tested at 62–383 species. Merging and rebuilding that branch would widen them,
and would change the numbers in the table above; they should be refreshed if it happens before submission.

## Questions for the authors

**Q1. Strand convention: a bug or a convention?** The repository's documents call it the "base-label bug"
of build 1. The 2016 paper says (Data calculation) that the heavy strand was analysed. The release-1 counts
are the complement of the deposited strand everywhere, which for most vertebrates is the heavy strand. The
draft therefore presents the change as a convention made explicit, which is the reading kinder to the 2016
authors and, as far as the paper says, the accurate one. Options: (a) keep the draft's wording
(recommended); (b) call it an error, if the 2015 pipeline was meant to count the deposited strand. Either
way, users of the old site's skews need the sign warning.

**Q2. Comparing with the 2016 count of "more than 3,780".** The 2016 count was made over other scopes
(families included) and, as far as the paper says, without a multiple-testing correction. The draft cites
the 2016 number in the Introduction and does not set the build-2 counts against it as a decline. Should
the paper reproduce the 2016 count on release 1 under the 2016 rules, to make the comparison exact?

**Q3. Data licence.** Release 1 was under a Creative Commons licence; build 2 mixes CC BY-NC values from
FishBase and SeaLifeBase (549 new species). Which licence does MitoAge state for its own tables?

**Q4. Taxonomy counts.** Order and family are not harmonised between the original species (AnAge taxonomy)
and the new ones (NCBI); 41 new species have no order. The 2016 paper gave 304 families, 106 orders and
13 classes; the release-1 export as processed has 103 orders. The draft leaves order and family counts out
until open question (e) of `docs/BUILD2_OPEN_QUESTIONS.md` is decided.

**Q5. Contrasts in poorly resolved clades.** Before Table 3 is final:
- Chondrichthyes: 494 of 1,212 tests at PIC p < 0.05, 2 at q < 0.05. Clupeiformes 61 of 161, Rajiformes
  57 of 152, Acipenseriformes 62 of 158. Under the null about 5% would be expected. This suggests
  contrasts standardised over near-zero branch lengths (polytomies resolved as zero-length branches, or
  interpolated node ages), not biology. A check: compare the PIC result with one on a tree where the
  polytomies are resolved randomly with small positive branch lengths, or with a diagnostic of absolute
  standardised contrasts against node height.
- The correlation table contains a scope `order:` (41 species with no order) that should not exist.
- Across all scopes, 18.5% of the lifespan tests have PIC p < 0.05; the PIC column total (2,577) is
  reported in the table but not in the text for this reason.

**Q6. The example from mitoage-pipelines.** Its own README says "Nothing here is peer reviewed". A database
update paper can carry a short worked example; whether to carry these results, or only point to the
repository, is the authors' choice. The example now reports the rerun on the dated tree (2026-11-14), in which
no amino acid passes a 5% false discovery rate in mammals; the threonine claim is cited to Kitazoe et al. 2008
(ref. 33, higher primates) and set against Aledo, Valverde & de Magalhães 2012 (ref. 34, 173 mammals).

**Q7. The reproduction document.** `docs/BUILD2_REPRODUCTION.md` of mitoage-pipelines was not on its
origin/main at the time of writing (head b113c0b). Once it lands, the Methods sentence on the independent
rebuild should say what it reports (how many values match), and both repositories should be cited by a
tagged release with a Zenodo DOI.


**Q11. Does the paper carry the repeats, motifs and rate subsection?** It reports three negative results and
one withdrawn positive. It argues the paper's own case - that correlations of this kind do not outlast a
control for ancestry - on features the 2016 release did not have, and it answers reference 18 directly. It
also lengthens the Results and rests on a feature set that currently covers 922 of 2,335 species. Keeping
it, cutting it to a paragraph in "What the controls change", or leaving it to the analysis repository are
all defensible. Related to Q6, which asks the same of the amino-acid example.

## Figures

Figures are numbered in order of first citation (draft 0.1's planned Figures 1 to 4 are now 3, 5, 1
and 2; the alignment is 4). Figures 3, 4 and 5 are screenshots of the site, in `figures/` as JPEG. The
site was built with `bun run build` from this repository at f06a0ac on 2026-11-14 (site code and data as at 84ba6f7, the
commit every number comes from), served with `bun run preview`, and captured in headless Google Chrome 157
over the DevTools protocol: light theme, 1,440 × 1,400 CSS pixels at a device scale of 2, each panel cut to
its card. ImageMagick put the panels together and wrote the JPEGs (quality 85). The capture script was a
one-off and is not in the repository. The pages, with what was done on each before the capture:

| Panel | Page | State |
|---|---|---|
| 3A | `/species/` | sorted by maximum lifespan, longest first |
| 3B | `/tree/` | as it opens (by rank, lifespan ring) |
| 3C | `/compare/class/mammalia/?chart=r` | the Regions card: chart and the top of its table |
| 3D | `/species/balaena-mysticetus/` | the Genome map card |
| 4 | `/genes/cox1/` | Alignment card, class Mammalia, longest-lived first |
| 5A | `/compare/plot/?x=maxLongevityYears&y=gc:total_mtDNA&scope=class:Mammalia&fit=1&highlight=homo-sapiens,balaena-mysticetus,heterocephalus-glaber,mus-musculus` | the plot card and the corrected statistics |
| 5B | the same page | Strongest correlations, as it opens (maximum lifespan, all species), first 10 rows |

Every number in the figure legends was read off the screenshots. Two differ from the text on purpose: the
scatter of Figure 5A and its live statistics use all 627 mammals the site lists, where the text's r = 0.47
uses the 615 of the default dataset; and the explorer's count of features that "hold up" on contrasts (424
for all species) does not require the same sign, where Table 3's "Both" (250) does.

Headless Chrome 157 returned a stale computed colour when an element's inline style changed within one
task, so the tree (3B) and the alignment (4) drew every mark in one colour. The capture read each colour
from a fresh element instead, which matches what the app's own Chromium 156 draws on the same pages. A
headed Chrome 157 resolves the same colours correctly on the live site (checked on 2026-11-14), so this is
a quirk of headless capture, not of the site.

Figures 1 and 2 are charts of `dist/data/correlations.parquet` as `bun run build` wrote it on 2026-11-14
(site code and data as at 84ba6f7), rows of dataset `default` and trait `maxLongevityYears`, with the
definitions of Table 3 above. A one-off TypeScript script read the file with hyparquet, drew each chart as
SVG and had headless Chrome render it at three times its size; ImageMagick wrote the JPEGs (quality 92).
The script is not in the repository.

- **Figure 1** stacks, for each scope of Table 3, the tests with p < 0.05 by the furthest control they pass
  in turn (FDR, then contrasts with the same sign, then body mass), as a share of the scope's tests. Each
  stage is a subset of the one before, so the segments are exact differences of Table 3's columns. The
  four greens are one ordinal ramp (#86c27c, #4fa65a, #1f8a3b, #0b3a1c), checked for monotone lightness,
  step gaps and contrast with the white page.
- **Figure 2** places the 64 codons of `codon:total_pc:*` in scope `all` by Pearson r and contrast r, one
  panel per third base, filled where the codon passes all three controls. The bases wear the site's
  nucleotide colours (`--nt-t`, `--nt-c`, `--nt-a`; G one step darker than `--nt-g`, #e09a10, to show on
  white). As four colours in one scatter they fail a colour-blindness check (A against U), so each panel
  shows one base and greys the rest.

Recomputing Table 3 from the same file for Figure 1 reproduced every count in it. The total row's count of
scopes was wrong in draft 0.1: the table holds 33 scopes (32 named and the empty `order:`), not 34.

## Not yet done
- No reference-check pass; references 19, 21, 24–32 and 35–36 are new.
- No journal formatting (NAR word limits, the required sections and the data-availability statement).
