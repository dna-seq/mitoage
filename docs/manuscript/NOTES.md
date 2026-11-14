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
| Example (threonine, cysteine, methionine, the site screen) | `dna-seq/mitoage-pipelines`, `docs/HYPOTHESES.md` at b113c0b, H1 and H2 |

Definitions used for Table 3: "FDR" is `q_value < 0.05`; "PIC" is `pic_p_value < 0.05`; "Both" adds
`sign(pearson_r) == sign(pic_r)` to both; "All three" adds `partial_p_value < 0.05`. The repository rule
"a number shown on the site is one the pipeline computed" does not cover these counts. If the paper
keeps Table 3, the pipeline's report should emit it, so the manuscript can cite the report instead.

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
repository, is the authors' choice. The claim that long-lived mammals have more threonine has no reference
in the draft; `docs/HYPOTHESES.md` calls it "published".

**Q7. The reproduction document.** `docs/BUILD2_REPRODUCTION.md` of mitoage-pipelines was not on its
origin/main at the time of writing (head b113c0b). Once it lands, the Methods sentence on the independent
rebuild should say what it reports (how many values match), and both repositories should be cited by a
tagged release with a Zenodo DOI.

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
- No reference-check pass; references 19, 21 and 24–32 are new.
- No journal formatting (NAR word limits, the required sections and the data-availability statement).
