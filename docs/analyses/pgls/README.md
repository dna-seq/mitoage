# PGLS with Pagel's lambda over every lifespan test (A3, D18)

The analysis A3 of `docs/REVIEW_ANALYSES_PLAN.md`: a second ancestry control for every lifespan test of the
correlation table that does not rest on the contrast t test.

## The run

- **Code:** commit `f360eea` of `main`: `pipeline/lib/pgls.ts`, `pipeline/pgls-table.ts`.
- **Job:** Slurm array job 6490080 on haumea, 32 tasks, one per scope (`pipeline/pgls-table.sbatch`), each
  under 3 minutes. Run from the clone `/data/uq2347/runs/mitoage/pgls`.
- **Data:** the committed build of `f360eea`, dataset `default`. That build includes the gene patch of
  `03c0949` (the African grey parrot's ND6). Round v0.3 was computed on `fb54cec`'s build: there 4,295 tests
  pass the FDR, here 4,296. The cause of the difference of one was not traced.

## The model

On each test's species that have a place in the dated tree, the feature is the response. Two fits per test,
λ estimated by maximum likelihood in [0, 1] in each:

- `pgls_*`: feature ~ log10 maximum lifespan;
- `pgls_mass_*`: feature ~ log10 maximum lifespan + log10 adult body mass, fitted when at least 10 of the
  species have a mass. The slope reported is lifespan's.

## Files

- `scopes/<scope>.tsv`, one row per test. Besides the table's own values (`n`, `pearson_r`, `p_value`,
  `q_value`, `pic_r`, `pic_p_value`, `pic_mass_p_value`), for each fit:
  - `_n`, `_lambda`, `_slope`, `_se`, `_p`, `_loglik`;
  - `_bm_p`: the p value with λ fixed at 1;
  - `_refused`: why no fit was made, empty when one was.
- `summary.tsv`, written by `bun run pipeline/pgls-table.ts summarize`, one row per scope. Its columns:
  - `fdr`: the tests passing the FDR across species;
  - `pgls_p05`, `pgls_q05`: PGLS p < 0.05, and q < 0.05 within the scope;
  - `fdr_and_pgls`, `fdr_and_pgls_mass`: FDR, and PGLS p < 0.05 with the sign of the correlation across
    species;
  - `fdr_and_pic`: Table 3's "Both";
  - `fdr_and_pic_and_pgls`: both ancestry controls;
  - the median λ, and how many λ sit at 0 or 1.

## Checks

- **λ = 1 reproduces the table.** With λ fixed at 1 the model is Brownian motion on the tree. The lifespan
  slope's p value then equals the table's contrast p value: `pic_p_value` without mass, `pic_mass_p_value`
  with it. Every task compared the two on every test; no difference above 1e-6 relative was found in any of
  the 15,906 tests.
- **Refusals.**
  - Too few masses: no fit with mass in Amphibia, Bivalvia, Caudata, Centrarchiformes, Clupeiformes,
    Rajiformes, Scombriformes and Siluriformes, and for 18 tests in Pleuronectiformes. This is the table's
    own minimum of 10 species with a mass.
  - Singular: 30 fits with mass whose least-squares system was singular; their causes were not examined one by one.
  - One fit without mass, in Bivalvia (GCC in ATP8). Its feature is 0 in all 14 bivalves with a place in the tree; the
    one nonzero value is in *Cryolaternula elliptica*, which the tree lacks.

## What the counts show

| | Contrast t test (Table 3) | PGLS |
| --- | ---: | ---: |
| FDR-passing tests significant with the same sign, 32 scopes | 900 of 4,296 | 893 of 4,296 |
| The same with body mass in the model | 393 (PIC + mass) | 430 |
| Both ancestry controls | — | 576 |
| All lifespan tests with p < 0.05, any sign | 3,023 of 15,906 | 1,792 of 15,905 |

**Where the test across species finds almost nothing**, PGLS rejects close to the 5% expected by chance. The
contrast t test does not:

| Scope | FDR-passing | Contrast t, p < 0.05 | PGLS, p < 0.05 |
| --- | ---: | ---: | ---: |
| Chondrichthyes | 2 | 585 of 1,368 | 75 of 1,368 (5.5%) |
| Amphibia | 0 | 146 of 1,386 | 67 of 1,386 (4.8%) |
| Bivalvia | 0 | 90 of 1,331 | 66 of 1,330 (5.0%) |
| Rajiformes | 0 | 74 of 191 | 24 of 191 (12.6%) |
| Clupeiformes | 0 | 70 of 200 | 44 of 200 (22.0%) |

The contrast column is from `docs/analyses/pic-calibration/summary.tsv`, the EURING build's calibration. This
is an observation, not a calibration run: no null was simulated for PGLS. Rajiformes and Clupeiformes stay
above 5%. Clupeiformes, whose contrasts one sister pair dominates (`docs/PIC_CALIBRATION.md`), has 24 tests at
PGLS q < 0.05 with no correlation passing the FDR across species.

**Where the totals agree, the scopes do not.** The 893 and the 900 are made of different tests:

| Scope | Contrast t "Both" | PGLS | Both controls |
| --- | ---: | ---: | ---: |
| Mammalia | 164 | 260 | 157 |
| All species | 292 | 232 | 133 |
| Actinopterygii | 221 | 148 | 87 |
| Aves | 55 | 69 | 41 |

The median λ is 0.96 in mammals and 0.98 in all species and ray-finned fishes. λ sits at 1 in 210 of the 1,398
mammal tests and 118 of the 1,414 all-species tests.

## How the plan's rules read this

The plan fixed two rules for A2 and A3 before they ran:

1. A result that agrees with the sign-flip count within 10% confirms that count.
2. A result that differs from both the t test and the sign-flip count gets all three reported, none promoted
   without the maintainer.

PGLS fits neither. Its total agrees with the t test (893 against 900, under 1%) and not with the sign-flip
count (535). Its scopes differ from both. The rules did not foresee a match of totals made of different tests,
so how PGLS enters Table 3 and S1 was the maintainer's call. D19 decided it: a PGLS column in Table 3 and S1,
counted by `docs/manuscript/numbers.ts` from these tables.
