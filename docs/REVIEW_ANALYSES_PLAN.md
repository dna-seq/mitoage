# Analyses that answer the v0.3 skeptic

A plan, written 2026-11-15 and run by nobody yet. It answers the skeptical referee of round v0.3 (run
`20261115T132217Z-c1672440`), whose verdict on the paper as a regular research article was:

> its findings are a largely negative re-analysis whose counts come from an uncalibrated test, whose central
> negative reading has no power estimate and whose posed question is not answered; the positive result is
> modest. A version with calibrated counts, a power analysis and a like-for-like comparison with release 1
> could be reconsidered.

Three of the four points are fair, and the paper concedes each of them in its own words:

- **Calibration.** The Results report that, with lifespan shuffled, the contrast test rejects 29% of tests
  in all species and 22–33% in the fish scopes, yet the headline counts (900 "Both", 550 "All three") use
  that test (D10, D13).
- **Power.** The Discussion says the correlations lost on contrasts "mix those absent within lineages with
  those too weak to detect there". Nothing in the paper says which is which.
- **The question.** The Introduction poses two causes of the loss: sources that drift and differences among
  clades. The Discussion says "how much of that loss the re-derivation alone causes was not measured".

The fourth point, a modest positive result, is what the data give. It is not an analysis to run.

Each analysis below states, before it runs, what it computes, on which data, where it runs, and how each
outcome will be read. Those reading rules are fixed here so that the result cannot choose them.

## What already exists, and what is running

- `pipeline/pic-calibration.ts` and `pipeline/pic-calibration.sbatch`, in this repository. Per scope and
  per lifespan test, they compute: the contrasts; 1,000 Brownian-motion lifespans on the dated tree; 1,000
  shuffles of lifespan; a sign-flip p value; contrasts with body mass partialled out. The per-test results
  are in `docs/analyses/pic-calibration/scopes/` (`bm_reject`, `perm_reject`, `signflip_p`, `mass_r`,
  `mass_p`). They describe the build **before** EURING.
- **Running on haumea at the time of writing, in another session:**
  - the same calibration on the EURING build (array job 6489844, `/data/uq2347/runs/mitoage/pic-euring`);
  - the manuscript's cluster analyses on it (`mitoage-rerun`, `/data/uq2347/runs/mitoage/euring-rerun`).

  This plan starts from those outputs and does not repeat them.
- `mitoage-pipelines`, `src/mitoage_pipelines/longevity/power.py`: the smallest effect a test detects with
  80% power, read from the standard errors of the tests themselves (written for H2's column screen).
- Build 1 as published in 2015: the `build1/` folder of the Hugging Face dataset `longevity-genie/mitoage`,
  34 parquet files converted from the 2015 CSV export without changing a value. The base columns are
  complement-labelled (Supplementary Methods S5). The site pipeline's own copy is in `data/input/`, which is
  not in git (RM7).
- `pipeline/lib/stats.ts`: `picFast`, `signFlipPValue`, `partialContrastCorrelation`, and the Pearson and
  Benjamini–Hochberg code that Table 3 uses. Every analysis in this repository calls these, so that its
  numbers come from the same code as the table they qualify.

## A. Calibrated counts: how many of the 900 are expected by chance

The question is not whether the t test over-rejects; that is measured. It is how many of the headline
passes chance alone would produce, scope by scope, so that every count can be read against its own null.

**A1. Expected chance passes, from the calibration outputs.** Laptop, minutes, TypeScript
(`pipeline/review-analyses.ts calibrated`). A test passes "Both" when it passes the FDR across species and
its contrast test is significant with the same sign. Under a null for the contrast test, chance alone
produces that second step with probability about half the test's null rejection rate. So, for each scope,
the expected chance passes among its FDR-passing tests are:

- **upper:** the sum of `perm_reject / 2`, under shuffled lifespan;
- **lower:** the sum of `bm_reject / 2`, under Brownian lifespan on the tree.

Both bounds are reported beside the observed count. The same goes for "All three" and "PIC + mass", using
the joint null where the calibration run recorded one, and nothing where it did not; this is said, not
estimated.

The two nulls bracket the truth rather than estimate it. The shuffle destroys lifespan's phylogenetic
signal, which real lifespan has. Brownian motion assumes normal contrasts of equal variance, which real
lifespan does not have (`docs/PIC_CALIBRATION.md`). Tests within a scope are correlated, so these
expectations are means, not an error rate with a binomial interval.

**A2. A calibrated per-test p value: phylogenetic permutation.** haumea, an array job per scope,
TypeScript. Permute log10 lifespan among the tips with probabilities that favour close relatives (Lapointe
& Garland 2001), keeping the scope's phylogenetic signal in lifespan while breaking its link to the
feature. Then read each observed contrast r against those permutations: 9,999 per scope, shared by all its
features, as in `pic-calibration.ts`.

The permutation kernel's one parameter is chosen before any test is read: the value at which permuted
lifespan has the same Pagel's λ as the observed one, per scope. Check before use: the method was read from
memory of the literature, not from the paper. Read the paper, and if the kernel cannot be matched to λ,
say so and stop at A1.

Outcome: a `pic_perm_p` beside `pic_p_value` and `pic_signflip_p`, and its Both count.

**A3. A second ancestry control over the whole table: PGLS with Pagel's λ.** haumea, `mitoage-pipelines`
(Python: `pgls.py` already fits it, with dense covariance), one array task per scope. Fit each feature on
log10 lifespan, and once more with log10 body mass. This is the analysis the Discussion names as the next
one. D13 rejected it as a presentation choice for v0.3; running it now is the maintainer's decision
(question 2 below).

Cost estimate, not measured: about 1 s per likelihood on the 2,211 species of the all-species scope, about
20 per fit and 2,800 fits there, so several CPU-days over the 32 scopes, well within one array job.

**How each outcome is read:**

| If | Then |
| --- | --- |
| The upper chance bound is a small part of the observed count (under a fifth) in a scope | That scope's count stands as printed, with the bound beside it |
| The upper bound reaches half the observed count or more | That scope's count is not interpreted; the text says so (the fish scopes are expected here) |
| A2 or A3 agrees with the sign-flip count within 10% overall | The sign-flip column is confirmed by an independent null, and the text says so |
| A2 or A3 differs from both the t test and the sign-flip count | All three are reported; none is promoted without the maintainer |

Which count leads the abstract and Table 3 stays D10's and D13's: the t test, unless the maintainer amends
it (question 1 below).

## B. Power: separating "absent within lineages" from "too weak to see"

**B1. Detectable correlation per scope, by simulation.** Laptop or haumea, TypeScript, an extension of
`pic-calibration.ts`. The species, tree and masses are each scope's own. Two models:

- **Model-based:** feature and lifespan evolve as bivariate Brownian motion on the scope's tree with
  evolutionary correlation ρ.
- **Data-based:** the observed log10 lifespan is kept, and the feature is simulated as β × lifespan plus
  Brownian noise on the tree, with β set so that the expected contrast correlation is ρ. This keeps the
  heavy-tailed lifespan contrasts (the *Dipturus*/*Zearaja* pair) that make the fish scopes over-reject.

The grid is ρ ∈ {0.05, 0.10, 0.15, 0.20, 0.30, 0.50}, with 1,000 replicates each. The output is the power
of each step of the funnel (FDR across species at the scope's own threshold, the contrast t test, sign-flip,
PIC + mass), and the smallest ρ each step detects with 80% power.

**B2. Bounded or inconclusive, test by test.** Laptop, from the correlation table. For every correlation
that passes the FDR and fails on contrasts, take the 95% interval of its contrast r (Fisher z on m − 1
contrasts). Then:

- **bounded:** the interval excludes |r| ≥ the scope's 80% detectable ρ from B1, so an effect of a size the
  test can see is ruled out;
- **inconclusive:** the interval does not exclude it.

The interval inherits the t test's miscalibration, so B2 is reported only in scopes whose shuffle rejection
rate is under 10% (Mammalia, Reptilia, and most orders), and the text says which.

**B3. Could the retests have seen the published effects?** Laptop, `mitoage-pipelines`, an extension of
`power.py` from H2 to H1 (amino acids), H7 (rates), H8 (repeats and motifs) and H12 (contacts,
hydropathy). It reads each test's standard error from its own table, gives the smallest effect detectable
with 80% power, and sets that beside the effect each source paper reports, in the same units:

| Claim | Source |
| --- | --- |
| Cysteine | ref. 30 |
| Methionine | ref. 31 |
| Threonine | ref. 33 |
| Protein evolution rate | ref. 16 |
| Inverted repeats | ref. 18 |

Each published effect is taken from the paper's own text or table, with the quoted passage recorded. Where
a paper gives no effect in usable units, the row says "not comparable", and no effect is converted by
assumption.

**How each outcome is read:**

| If | Then the retested relationship is |
| --- | --- |
| The published effect lies above the smallest detectable effect, and our interval excludes it | Not detected, with power: a negative result |
| The published effect lies below the smallest detectable effect | Inconclusive: the test could not have seen it |
| The test may be biased towards the null (H7's saturated dS) | Inconclusive whatever the power, unless D below is run |
| The answer depends on the model of ancestry (H1: PGLS against random intercepts) | Inconclusive, with both answers given |

These verdicts fill the "verdict" column of the main-text table of retested relationships, which replaces
the subsection-long walk through each retest. The analyses run and not reported (S12.5: RELAX that did not
reproduce, Coevol that did not converge) get a third verdict: not assessed. They stay in the supplement.

## C. Like-for-like with release 1: where the correlations went

The decomposition is done on the species that are in both releases and still live: 903 of the 922 (19 are
retired), renamed species joined by their release-1 id. Each step changes one thing. The order is fixed
here and reported in both directions:

| Step | Values | Lifespans | Species | Scopes | Test |
| --- | --- | --- | --- | --- | --- |
| C0 | release 1 | release 1 | 922 | the 2016 scopes, families included | the 2016 rule (p < 0.05, no correction, as far as the 2016 paper says) |
| C1 | release 1 | release 1 | 903 | Table 3's (≥ 20 species, class and order) | the same |
| C2 | build 2 | release 1 | 903 | Table 3's | the same |
| C3 | build 2 | build 2 (AnAge only) | 903 | Table 3's | the same |
| C4 | build 2 | build 2 (AnAge only) | 903 | Table 3's | + FDR, + contrasts, + mass: the funnel |
| C5 | build 2 | build 2 | all of `anage_only`, then `default` | Table 3's | the funnel (Table 3 itself) |

- **C0** asks whether the 2016 count of "more than 3,780" can be reproduced from the release it came from
  (NOTES.md, Q2). If it cannot, the comparison starts at C1, and the text says the 2016 count was not
  reproduced and by how much it differs.
- **C1 to C2** is drift in the mtDNA values alone. **C2 to C3** is drift in lifespan.
- **C3 to C4** is what the controls remove from the same species and the same data. The funnel is also run
  on release 1's own values (C1 + controls on the pruned tree), so that "release 1 would have lost the
  same share to contrasts" can be said or refuted directly.
- **C4 to C5** is what the new species add.

Strand: release 1's base columns are complement-labelled (S5). They are relabelled to build 2's
convention before any comparison, using the rule `mitoage-pipelines` documents in `BUILD2_REPRODUCTION.md`.
GC content and the GC/AT balance's magnitude are unaffected, the balance's sign flips, and codon usage
needs checking before use. Features that release 1 does not have (the extended features) are left out of
every step, so the feature set is the same throughout.

Where: laptop, TypeScript (`pipeline/review-analyses.ts release1`), reading release 1 from the Hugging Face
`build1/` folder, so that it does not depend on `data/input/` (RM7). It calls the correlation and PIC code
of `pipeline/lib/stats.ts`, the code behind Table 3. Light: about 1,400 features over about 30 scopes per
step, which is what one site build computes. Sign-flip p values are computed for C4 only.

**How each outcome is read:** the answer is a waterfall from C0 to C5, in counts and shares, and the text
reports the largest step as the main cause. No outcome is preferred. If the controls on release 1's own
values remove the same share as on build 2's, then drift did not cause the loss, and the paper says so
plainly, though it weakens the story about drifting sources.

## D. Not asked by the skeptic, needed for one verdict

**D1. The rate of protein evolution with a model that lets rates vary across sites.** H7's relative-rate
test uses Nei–Gojobori distances, whose dS exceeds 1 in 24% of the pairs. Galtier et al. (ref. 16) explain
earlier opposite results by exactly such methods. Without a codon model (HyPhy or PAML, rate variation
across sites, on the same 339 sister pairs or on branch lengths fitted on the dated tree), H7's verdict
stays "inconclusive". Whether to run it is question 3 below. haumea, `mitoage-pipelines`.

## Order, places and outputs

1. Wait for `pic-euring` (6489844) and `euring-rerun`; fetch their outputs, so that every number below is
   on the EURING build. The cluster pulls `main`; no code goes there that is not on `main`.
2. **A1, B2, C** on the laptop, from this repository. All three read only the committed build and the
   calibration outputs.
3. **B1 and A2** on haumea, one array job per scope from a commit on `main`. Results come back as their own
   commit, naming the commit they ran from.
4. **B3** on the laptop, `mitoage-pipelines`, from the tables of `euring-rerun`.
5. **A3 and D1** on haumea, only if the maintainer says yes.
6. Results go to `docs/analyses/review/`, with a README naming the commit, the job ids and the cluster
   paths, and into `docs/ANALYSIS_FINDINGS.md`. The manuscript changes in the next round (v0.4): the
   chance bounds in Table 3 and S1, a "Where the correlations went" subsection from C, the table of
   retested relationships with its verdicts, and a Discussion that reports bounded results as bounded.

Each new function gets a test that runs it on real data and is checked by breaking the code it guards
(`CLAUDE.md` §2). For B1, a simulated ρ = 0 must give 5% rejection under the model-based arm, as
`pic-calibration.ts` already shows for Brownian lifespan.

## Questions for the maintainer

1. **Which count leads.** D10 and D13 keep the t test as the headline, with the sign-flip count beside it.
   - (a) Keep that, and add A1's chance bounds beside every count. Costs one more column of Table 3, and no
     count drops. **Recommended:** it answers "uncalibrated" without "overdropping", in the maintainer's
     word of D10.
   - (b) Make a calibrated count the headline (sign-flip, or A2 once run). Amends D10 and D13. All species
     falls from 292 "Both" to 103, and the abstract's "one in five" becomes about one in eight.
   - (c) Report all three side by side with no headline. Costs clarity in the abstract.
2. **A3: PGLS over the whole table.**
   - (a) Run it. Several CPU-days on haumea, and a new column or supplementary table. **Recommended:** it is
     the one ancestry control that does not rest on the contrast t test, and the Discussion already says it
     is needed.
   - (b) Not now. The answer to "uncalibrated" rests on A1 and A2.
3. **D1: the rate test with a codon model.**
   - (a) Run it. A day or two on haumea, plus a tool to set up.
   - (b) Label H7 "inconclusive" and say why. **Recommended for the next round,** since it costs nothing and
     is accurate. Then (a) when there is time.
