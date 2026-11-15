# MitoAge 2 manuscript: notes for the authors

Companion to `mitoage2.md` (draft 0.1, 2026-11-14). It says where every number in the draft comes from
and lists the questions only the authors can answer.

## How the draft is built

- **Model.** The 2016 paper (Toren et al., NAR 44:D1262) is a short Database-issue article: Introduction,
  Database content and interface, Data sources and curation, Data calculation, Availability, Conclusion.
  The draft keeps its voice and its opening references (numbered as in 2016 so the two lists can be
  compared), and adds a Materials and methods section, because what is new in build 2 is mostly method:
  pinned sources, re-verification, a dated tree, three controls, two reproductions. Restructured on
  2026-11-15 for the reprioritized venues: Introduction, Results, Discussion, Materials and methods (see
  "Restructure" below).
- **The story.** One argument runs through it: the sources drift, the 2016 correlations were counted
  without controls for shared ancestry, and most do not survive one; what survives is concentrated in the
  strand asymmetry and the codon usage it shapes. The abstract, the Results and the Discussion all carry
  that argument; the website is described after it, as the last two subsections of the Results.
- **Claim ceiling.** The draft does not claim that any mtDNA feature causes or predicts lifespan. The
  codon finding is phrased as "the direction expected from" the heavy-strand A>G signature, not as
  evidence for it.

## Where the numbers come from

Every number is from `dna-seq/mitoage` at commit 84ba6f7 (origin/main, 2026-11-14), build 2 of 2026-11-13; the
correlation numbers (Table 3, the funnel, Figures 1, 2 and 5) are from the table as rebuilt at 1dda8be, with the
extended features and 32 scopes.

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
| Datasets 2,202 / 1,710; agreement r = 0.977 | `docs/BUILD2_REPORT.md`, "Correlation datasets" and "Agreement between the datasets" |
| 192 tests, cross-check (1,413 = 1,413; 99.0% of 3,325 keys) | `docs/BUILD2_REPORT.md`, "Commands" and "Cross-check with the audit" |
| Table 3, the funnel (15,904 / 5,439 / 4,299 / 3,008 / 896 / 547), AnAge-only (4,068 / 659), every r and p in "What the controls change" | `dist/data/correlations.parquet` rebuilt 2026-11-15 after the empty-order scope was dropped from `buildScopes` (IC-8), trait `maxLongevityYears`, dataset `default`; the counts were made in an analysis session, not by the pipeline (IC-15 asks the build report to emit them). The earlier funnel (13,947 / 4,851 / 3,854 / 2,577 / 770 / 472) was computed before the repeat, motif, fourfold and hydropathy features joined the feature catalogue at e3d99b2 and so shared the Benjamini-Hochberg pool; it is reproducible from the rebuilt table by restricting to the classic feature families. |
| Codon third-position pattern (8 U-ending down, 8 C-ending up) | same file: scope `all`, features `codon:total_pc:*` with q < 0.05, PIC p < 0.05 with the same sign, and partial p < 0.05 |
| Example (threonine, cysteine, methionine, the site screen) | `dna-seq/mitoage-pipelines` at da0c112: `aa_pgls.<Class>.tsv` from `mitoage longevity aa-pgls` (H1, method `pgls`, model `mass+composition`; the mixed-model count from method `mixed`), H2 from `pgls.Mammalia.tsv`; `docs/HYPOTHESES.md` |
| Reproduction: all 5,302,404 values of the seven tables, the 28 alignment files and the dated tree come out identical | `dna-seq/mitoage-pipelines`, `docs/BUILD2_REPRODUCTION.md` at 3550281 (origin/main), "How far it reproduces" |
| 481 of the 547 "All three" keep the sign of the correlation across species in the partial correlation (66 reverse); the partial is positive for UGG and GGG | `dist/data/correlations.parquet` as above: `sign(partial_r) == sign(pearson_r)` among the "All three" rows |
| Partial-correlation sample 1,384 of 2,202 (235 of 827 ray-finned fishes); whole-genome GC within classes, r and partial r (Mammalia 0.47 / 0.40, Actinopterygii 0.034 / −0.14 with p = 0.04, Aves 0.048 / 0.05, Reptilia 0.006 / −0.01) | same file: `partial_n`, feature `gc:total_mtDNA`, scope `all` and the class scopes |
| Survivors by feature: codons are 54% of the tests and 54% of the 547; in all species 27 of 40 skew, 11 of 16 GC-content and 138 of 744 codon correlations that pass the false discovery rate pass all three controls | same file, the funnel grouped by feature family |
| Exclusions behind 2,202: 49 estimated and 65 questionable lifespans | computed from `public/data/species.parquet` (live species, lifespan quality and method) |
| 106 invertebrates: 104 non-chordates, a lancelet and an ascidian | computed from `public/data/species.parquet` (live species by phylum and subphylum) |
| Cross-check: 8,733 changelog rows compared for the original species, 3,325 in both, 5,394 of the other 5,408 `refseq_successor` | `docs/BUILD2_CROSSCHECK.md`, the comparison table and the successor counts |
| The MCP server's paragraph (Data access and versioning) and its sentence in Data availability | `mcp/` and `mcp/README.md`; D8 in `docs/DECISIONS.md`. Its verdict uses the Table 3 definitions below, so the server and the paper count the same rows |

Definitions used for Table 3: "FDR" is `q_value < 0.05`; "PIC" is `pic_p_value < 0.05`; "Both" adds
`sign(pearson_r) == sign(pic_r)` to both; "All three" adds `partial_p_value < 0.05`. The repository rule
"a number shown on the site is one the pipeline computed" does not cover these counts. If the paper
keeps Table 3, the pipeline's report should emit it, so the manuscript can cite the report instead.


### Repeats, motifs and the rate of evolution (added 2026-11-14)

Every number in this subsection comes from mitoage-pipelines main at 22cb140, run on build 2's species table,
the dated tree and the quality filter, with the motif features from this repository's pipeline, merged into
main at e3d99b2.

| Number in the draft | Where it comes from |
| --- | --- |
| Inverted repeats, mammals, r = -0.40 (p = 2 x 10^-24), n = 604 | `motif_pgls.tsv`, class Mammalia, feature `inverted_repeats_total`, `spearman_rho`/`spearman_p` |
| the same over the major arc, r = -0.33, n = 530 (p = 3 x 10^-15) | same table, `inverted_repeats_major_arc` |
| p = 0.67 and p = 0.45 after the controls | same rows, column `p` (phylogenetic GLS with body mass and fourfold composition, Pagel's lambda) |
| 132 tests in four classes, none passes; smallest q = 0.16 | `motif_pgls.tsv` row count, `q` column |
| contact-zone inverted pairs, mammals, r = -0.18 (p = 8 x 10^-6, n = 602), p = 0.03 after controls | same table, `contact_zone_inverted_pairs` |
| 339 sister pairs | `rate_contrasts.tsv`, rows with `gene == CONCAT` |
| mammals p = 0.02, q = 0.15 | `rates.tsv`, class Mammalia, gene CONCAT, normalisation `dS_mass_adj`, `includes_saturated` false |
| four of 655 single-gene tests pass and disagree in sign | `rates.tsv`: 655 rows, 4 with q < 0.05 (ND6 all species -0.219; Mammalia ND5 +0.220; Aves CYTB -0.021; Mammalia ND2 dN -0.017) |
| one record states a sequencing technology; 1,773 name a source INSDC accession | `assembly_provenance.tsv` from the haumea run of 2026-11-14 (`/data/uq2347/runs/mitoage/gaps/motifs/`) |

**Two results that were withdrawn, not one.** An exploratory Python run over 2,311 species, with tandem-repeat
counts that did not reject units built from a shorter period, gave mammalian G-quadruplexes at q = 0.048 over
601 species. Rerun on the database's own features while those still covered 922 species, that was gone
(q = 0.66) and a reptile G-quadruplex test passed instead (q = 0.027). On the full 2,335-species build the
reptile one is gone too (q = 0.38) and nothing passes at all. Three runs, three different survivors, none
reproducing: the draft reports the third and says the screen is null, and the trail is kept here.

**Coverage.** The motif features now cover all 2,335 species: the work was ported onto build 2 (decision D7,
merged into main at e3d99b2) and the features are ordinary members of the feature catalogue, so the false discovery
rate runs over the combined set. Classes are tested at 97 (reptiles) to 604 (mammals) species. The plot
explorer does not offer the new features yet (RM19), which does not affect any number here.

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

**Q5. Contrasts: the clades that over-reject, and why it is not the tree.** Updated 2026-11-15 against
the rebuilt correlation table (32 scopes) and `src/data/generated/phylogeny.json`.

- The anomaly is real. Chondrichthyes rejects 42.8% of its 1,368 lifespan tests at contrast p < 0.05
  while 0.1% pass the FDR; Rajiformes 38.7% of 191 and Clupeiformes 35.0% of 200, with none passing the
  FDR; Acipenseriformes 39.6% of 197. Under the null about 5% would be expected.
- **The explanation this note previously gave is wrong.** Measured on the dated tree: of 2,229 internal
  nodes only 54 are polytomies, and resolving them costs 75 degrees of freedom in total; 556 of 4,534
  branches have length exactly 0, but after the contrast variance recursion only 12 of the 2,229
  contrasts are standardised by a daughter-variance sum below 1 Myr, and none below 0.01. Contrasts are
  not being divided by near-zero numbers, so near-zero branch lengths cannot explain a tenfold excess of
  rejections.
- Nor is it a positivisation error: the rejecting contrasts are 54% positive in Chondrichthyes and 49%
  in Clupeiformes.
- Inverting the t test from the published `pic_r` and `pic_p_value` gives an implied df of about n − 3 in
  every scope (2,172 for the 2,202 species of the all-species scope, 79 for the 82 Chondrichthyes), so
  the test spends essentially the full n − 1 contrasts. The Purvis & Garland (1993) polytomy correction
  is missing but is worth about 1% of df here, not a tenfold inflation.
- What the numbers do show is heavy tails: among the rejecting tests |contrast r| averages 0.43 in
  Chondrichthyes and 0.61 in Rajiformes (21 species), where |r| across species averages 0.09 and 0.19.
  A through-origin correlation of a few dozen outlier-dominated contrasts is not described by a
  Student-t p value.
- What to run: (a) a permutation null — shuffle log10 lifespan across the tips within each scope,
  recompute the contrasts and correlate against the fixed feature contrast matrix, which gives both a
  calibrated p value and the empirical chance rejection rate PR-3 asks for (the analytic "about 96 of
  770" assumes independent tests, which these are not); (b) the Garland, Harvey & Ives (1992)
  branch-length diagnostic per scope; (c) record `pic_n` and `pic_df` in the correlation table — they
  are absent today, which is why this could not be diagnosed from the published table at all; (d) a
  second ancestry control, PGLS with Pagel's lambda, over the same tests.
- The empty `order:` scope is fixed: `buildScopes` in `pipeline/steps/correlations.ts` no longer groups
  species that have no name at a rank, so the table has 32 scopes and 15,904 lifespan tests (IC-8).
- Across all scopes, 18.9% of the lifespan tests have PIC p < 0.05; the PIC column total (3,008) is
  reported in Table 3 but not in the text for the reasons above.

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
and 2; the alignment is 4).

Every figure is made by a script in `figures/` from the current build (`bun run build` first), and the
JPEGs are overwritten in place. Redrawn and recaptured on 2026-11-15 for print sizes: one column 86 mm,
the page 178 mm, text at least 6 pt and images at least 300 dpi as printed.

```
bun docs/manuscript/figures/figure-1-controls.ts        # Figure 1
bun docs/manuscript/figures/figure-2-codons.ts          # Figure 2
env SITE_URL=https://just-dna.life BASE_PATH=/mitoage bun run preview --port 4349   # read the port it took from its log
bun docs/manuscript/figures/capture-figures-3-4.ts http://localhost:4349            # Figure 3, its supplement 1, Figure 4
bun docs/manuscript/figures/capture-figure-5.ts http://localhost:4349               # Figure 5
```

| Figure | Script | Printed width | Image | Smallest text as printed |
|---|---|---|---|---|
| 1 | `figure-1-controls.ts` | 178 mm | 3,000 × 2,568 px, 428 dpi | 7.6 pt |
| 2 | `figure-2-codons.ts` | 178 mm (158 mm tall) | 3,000 × 2,670 px, 428 dpi | 7.1 pt |
| 3 | `capture-figures-3-4.ts` | 178 mm: A across the page, B centred under it, 73 mm wide (218 mm tall) | 3,154 × 3,861 px, 450 dpi | A 5.0 pt, B 3.7 pt |
| 3—figure supplement 1 | `capture-figures-3-4.ts` | 178 mm: A (Regions) beside B (genome map), 86 mm each (160 mm tall) | 3,154 × 2,837 px, 450 dpi | A 6.0 pt, B 3.4 pt |
| 4 | `capture-figures-3-4.ts` | 86 mm (95 mm tall) | 1,524 × 1,678 px, 450 dpi | 4.3 pt |
| 5 | `capture-figure-5.ts` | 178 mm, A above B (207 mm tall) | 3,600 × 4,181 px, 514 dpi | A 5.3 pt, B 6.0 pt |

The screenshots cannot reach 6 pt by cropping alone: the site's smallest text is 8.4 to 13 CSS px, and the
narrowest layout that keeps a panel whole is 520 to 1,300 px wide. 3A needs 1,360 px before the table
stops scrolling sideways, so it is set across the page (decision D7: Figure 3 keeps A and B, and the Regions
chart and the genome map moved to Figure 3—figure supplement 1); the genome map draws its scale at 8.4 px; the alignment viewer cuts species
names when its grid is under 560 px. Each script prints the smallest text of each panel and its printed size.

- `figure-1-controls.ts` and `figure-2-codons.ts` read `dist/data/correlations.parquet` with hyparquet
  (dataset `default`, trait `maxLongevityYears`, the definitions of Table 3 above), draw SVG, have headless
  Chrome render it at three times its size, and have ImageMagick write the JPEG (quality 92). Figure 1 holds
  a copy of Table 3 and refuses to write when any count differs; Figure 2 refuses unless exactly the twenty
  codons the legend names pass all three controls.
- `capture-figures-3-4.ts` and `capture-figure-5.ts` drive headless Google Chrome 157 over the DevTools
  protocol through `cdp.ts` (light theme, device scale 3), each panel at the narrowest viewport that keeps
  it whole, and have ImageMagick label and join the panels (quality 90). `cdp.ts` also holds the colour
  workaround below and turns sticky bars to relative so they are not painted over a capture.

| Panel | Page | Viewport | State and cut |
|---|---|---|---|
| 3A | `/species/` | 1,360 px | sorted by maximum lifespan, longest first; toolbar with the two download buttons, the count and the first eight rows |
| 3B | `/tree/` | 600 px | as it opens (by rank, lifespan ring); the tree and its legend, without the taxon card and the controls |
| 3—S1 A (was 3C) | `/compare/class/mammalia/?chart=r` | 560 px | the Regions card's title, chart, key and note, without the selectors |
| 3—S1 B (was 3D) | `/species/balaena-mysticetus/` | 640 px | the Genome map card's title, map, legend and keys, without the help card |
| 4 | `/genes/cox1/` | 660 px | Alignment card, class Mammalia, longest-lived first; title, count line, the first 20 rows (24 columns) and the colour key |
| 5A | `/compare/plot/?x=maxLongevityYears&y=gc:total_mtDNA&scope=class:Mammalia&fit=1&highlight=homo-sapiens,balaena-mysticetus,heterocephalus-glaber,mus-musculus` | 1,280 px | the plot card down to its class legend, beside the corrected statistics; without the hint, the switch, the buttons and the live statistics |
| 5B | the same page | 1,150 px | Strongest correlations as it opens (maximum lifespan, all species): the title, the summary line and the first five rows |

Panel 5B, as first retaken, showed two faults of the site: the intro line said "Rank all 1,257 mtDNA
features", and two of its top rows showed raw keys (`gravy:total_pc`, `ff:ND2:U`). Roadmap item RM19 fixed
both (the count comes from the data, and every extended feature has a name and a family), and Figure 5 was
recaptured in this layout from a build of `main` after RM19; every number in its legend was checked against it.

Every number in the figure legends was read off the images. Two differ from the text on purpose: the
scatter of Figure 5A shows all 627 mammals the site lists, where the text's r = 0.47 uses the 615 of the
default dataset; and the explorer's count of features that "hold up" on contrasts (496 for all species)
does not require the same sign, where Table 3's "Both" (291) does.

Headless Chrome 157 returned a stale computed colour when an element's inline style changed within one
task, so the tree (3B) and the alignment (4) drew every mark in one colour. The capture reads each colour
from a fresh element instead, which matches what the app's own Chromium 156 draws on the same pages. A
headed Chrome 157 resolves the same colours correctly on the live site (checked on 2026-11-14), so this is
a quirk of headless capture, not of the site.

- **Figure 1** stacks, for each scope of Table 3, the tests with p < 0.05 by the furthest control they pass
  in turn (FDR, then contrasts with the same sign, then body mass), as a share of the scope's tests. Each
  stage is a subset of the one before, so the segments are exact differences of Table 3's columns. The
  four greens are one ordinal ramp (#86c27c, #4fa65a, #1f8a3b, #0b3a1c), checked for monotone lightness,
  step gaps and contrast with the white page.
- **Figure 2** places the 64 codons of `codon:total_pc:*` in scope `all` by Pearson r and contrast r, one
  panel per third base, filled where the codon passes all three controls. Only the twenty that pass are
  labelled, placed so no label overlaps another or a coloured point, with leader lines in the crowded
  clusters; the legend's markers are drawn in all four colours. The bases wear the site's nucleotide
  colours (`--nt-t`, `--nt-c`, `--nt-a`; G one step darker than `--nt-g`, #e09a10, to show on white). As
  four colours in one scatter they fail a colour-blindness check (A against U), so each panel shows one
  base and greys the rest.

Recomputing Table 3 from the same file for Figure 1 reproduced every count in it. The total row's count of
scopes was wrong in draft 0.1: the table held 33 scopes (32 named and the empty `order:`), not 34; since the
IC-8 fix the empty scope is gone and the table holds 32.

## Supplementary Methods

`mitoage2.supplementary.md` (added 2026-11-15) is the long form of the Methods: sections S1 to S14, each the
flow of decisions behind one step (what was done, why, the alternative not taken, what it assumes, what is not
known), for a reader who will not open the code. The main text points to them ("Supplementary Methods S4") from
each Methods subsection, the two worked-analysis subsections and the MCP paragraph; it is otherwise unchanged.
Table 4 (the pinned versions) moved there as Supplementary Table S2 (D7), so the main text's tables are 1 to 3,
cited in order.

- **Where its facts come from.** Each rule cites its file, and where it matters the line, in a hidden
  `<!-- src: -->` comment: the pipeline code (`pipeline/`, `src/data/index.ts`), `docs/BUILD2_REPORT.md`,
  `BUILD2_CROSSCHECK.md`, `BUILD2_OPEN_QUESTIONS.md`, `ANALYSIS_FINDINGS.md`, `DECISIONS.md`,
  `plans/DATA_BUILD2_DECISIONS.md`, and in mitoage-pipelines (f2006a9) `docs/BUILD2_REPRODUCTION.md`, the README and
  the analysis code. Where no document records a reason for a choice, the text says so instead of supplying one.
- **Checked while writing.** The seven tables and 28 alignment files have the same SHA-256 in Hugging Face
  revisions 653afe2a (the reproduction's), 6efa0959 (the analyses') and c525adbf (the paper's); the two
  extended-feature tables exist only in c525adbf and equal `public/data/`. The strand diagnosis (0 of 18,030
  region rows match with release 1's labels, 17,677 after swapping) is from the first pipeline run's build
  notes (`plans/handoffs/HANDOFF_mitoage-next-site_2026-11-12.md`).
- **Found while writing, and asked in the supplement** (S14 lists them): the record-choice rule orders by date
  before length, against the default's wording (S2); the repeat and motif thresholds have no recorded source
  (S7.3); the versions and commands of the aligner comparison are not recorded (S8); the audit behind the
  cross-check is unpublished (S11); `aa-pgls`, `motif-pgls` and `rates`, which give every number of the two
  worked-analysis subsections, are not recorded as rerun (S11); the reproduction covers neither the
  extended-feature tables nor the correlations (S11). The contrast test is described as implemented; the
  `ape::pic` comparison and the cluster calibration are to be inserted in S10.6 when they report.
- **Edited** with manuscript-prose-edit and manuscript-deslop in run `20261115T064112Z-52913208` (not in git):
  claim guard clean against each pre-edit copy; three sentences of the first draft that stated something no
  document records were removed; 7 of 15 "X, not Y" contrasts rewritten, the rest kept as real distinctions.

## Restructure for the reprioritized venues (2026-11-15)

The maintainer asked whether the reprioritized journals need a Discussion and allow more text, that "skews"
be explained where it first appears, and that the text read "as a thinking flow ... hypothesis driven" rather
than as statements one after another.

- **What the venues ask.** The third journal selection (run `20261115T001950Z-ea39ab48`, `stage-report.3.md`)
  ranks eLife Tools and Resources, Frontiers in Aging and Life Science Alliance first, then Molecular Biology
  and Evolution (Resources). eLife: "Introduction; Results; Discussion; Materials and Methods", no maximum,
  but it suggests at most 5,000 words of main text "excluding the Materials and methods, References, and Figure
  legends", abstract 150 to 200 words; it allows Methods after the Introduction. MBE: the same order, abstract
  250, no limit, the order may change. Life Science Alliance: no body limit, abstract at most 175. Frontiers:
  Introduction, Materials and Methods, Results, Discussion, at most 12,000 words. Database (Oxford): the
  Frontiers order plus a Conclusion. A Discussion is expected everywhere; the Conclusion is Database's alone, so
  none was added. Materials and methods follows the Discussion, the order the top three of the ladder bar
  Frontiers share (decided with the coordinating session); Frontiers would move it back.
- **What changed.** The Conclusion became a Discussion that carries the interpretation, the caveats taken
  out of the Results paragraphs (contrast power and calibration, the uncorrected and one-at-a-time tests, the
  interpolated node ages, strand orientation, sequencing technology, the invertebrates), the published claims
  retested (refs 16, 18, 30, 31, 33, 34) and what comes next; the thesis line is kept word for word. The
  Introduction ends in the two questions and how each was tested; each Results subsection now runs from the
  question to the test, the finding and what it means for the next step, with "we" where the authors acted.
  The skews are defined in the Abstract and the Introduction; contrasts, scopes, q, the default dataset,
  retired species, the major arc and dN/dS where the Results first use them; the four survivor counts get a
  reading guide (896 and 547 are summed over overlapping scopes and read as shares, about one in five and one
  in eight of the 4,299; 291 is all species alone; 496 is the explorer's count without the sign rule). The
  website and data access became the last Results subsections. Methods moved whole, unchanged but for one
  "below" made "in Results".
- **New in the text, from documents already in the repository:** "66 of them" (547 − 481, the partial
  correlation's sign reversals, from the table above); the contrast code's agreement with `ape::pic` and the
  excess where one sister pair dominates (`docs/PIC_CALIBRATION.md`, D10); the Chondrichthyes rejection rate
  (42.8% of 1,368), moved from the `> AUTHOR:` note into the Discussion.
- **Checked** in run `20261115T065503Z-3539a7e9` (not in git; 17 change records, `runs.py apply`). Every
  number and citation of the base is still in the text. Claim guard (`--revision`): exit 0; it lists the new
  sentences, all reviewed, and "for the first time" was removed. Smell check (`--check`, em dashes kept as
  eLife's figure-supplement names): passes; declarative chains (C16) 9 → 3, all three in the affiliations.
  Reader metrics: "we" 0.02 → 0.36 per 100 words, acronyms 1.82 → 1.51; sentences over 35 words 12% → 16%,
  mostly the statistics sentences of the Results.
- **Length.** Prose of the main text without Methods, tables, legends and notes: 3,107 → about 4,350 words
  (eLife suggests at most 5,000); the Discussion is about 870 words against the Conclusion's 229; Methods
  unchanged at about 2,070. The whole file: 9,283 → about 10,650 words. Abstract about 230 words: within
  MBE's 250, above eLife's usual 200 and Life Science Alliance's 175.

## Not yet done
- Decided by the authors on 2026-11-15: D2, MitoAge 2's address is https://just-dna.life/mitoage/, with
  www.mitoage.info to follow once it is redirected; maintenance is by the authors as needed, errors through
  GitHub issues. D11, Author contributions in CRediT roles (A.K. most of the work, N.U. infrastructure, D.T.
  human validation of the AI-assisted work and editing before submission, R.T. supervision). D13, post on
  bioRxiv now; before posting, the AI-use statement (D9), the competing-interests and funding statements,
  and a copy without the draft header and the `> AUTHOR:` notes are needed. D1, the venue, is being
  re-evaluated for a December 2026 submission, publication by spring 2027, all analyses kept and no venue
  harsh on AI use.
- The decisions of the 2026-11-15 runs are in `mitoage2.dashboard.html` (To-do tab, 18 decisions; the run that
  revised the paper has its own dashboard, `mitoage2.revision-run.dashboard.html`; both files stay out of git).
  The venue comes first: a second journal selection that keeps the results and allows rolling submission
  recommends a bioRxiv preprint now, then eLife (Tools and Resources), Molecular Biology and Evolution
  (Resources) or Database (Oxford); NAR's Database issue (January 2028, results cut) is the slow option. The
  draft now follows eLife's order (see "Restructure" above).
- A second, independent panel read the revised paper for eLife: three major and three minor revisions, against
  five and one this morning (for NAR, so not like for like). What persists needs the authors: the contrast
  test's calibration (it rejects about 40% of tests in fish scopes, more than the uncontrolled test, which
  suggests checking the contrast code against an established implementation), strand orientation per record,
  a second ancestry model, and the Abstract's "independent reproduction", which does not cover the correlations.
- Figure 3 is split (D7): A and B stay, the Regions chart and the genome map are Figure 3—figure supplement 1. Its
  smallest text still prints under 6 pt (3B 3.7 pt, the genome map 3.4 pt; "Figures" above).
