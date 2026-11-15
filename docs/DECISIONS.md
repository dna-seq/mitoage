# Decisions

The calls settled with the maintainer, one section each, `## Dn — the call (date)`, newest last: what
was decided, why, and the alternative it rejected. A call is never edited after the fact; a later one
that changes it says which it amends.

## D1 — The seats kit, with one seat, the lead (2026-11-13)

The repository adopts the seats kit (agent-seat-blueprints): standing roles for agent sessions, each
with a written priming under `docs/seats/`. The maintainer's answers at adoption:

- **Seats:** the lead only ("So far let's have lead"). Offered and not taken now: a correspondence
  seat (the upstream databases' releases and users' reports) and a strategist; either is added later.
- **Machines:** the lead runs on a cluster and, ideally, on the maintainer's laptop too ("I want to be
  able to run both on cluster and laptop"); each machine has its own clone and its own chat account
  for the seat. Rejected: one machine only.
- **Tracked, not an overlay:** the seat table and the primings are committed; the maintainer is the
  only author, so nobody else's sessions change. The kit's plugin is not pinned in the tracked
  `.claude/settings.json`: a clone enables it locally. Either can change later.
- **The lead's grant:** commit, and push `main` as a fast-forward, which deploys the site
  (`docs/seats/LEAD.md`, "Grant"). Rejected: commit only.
- **The id** is `mitoage`: the chat channel, the seat's account `mitoage/lead` and the desk's label.

The last three were the wizard's defaults, left unchanged by the maintainer.

## D2 — The maintainer's global permission to push holds for a session without a seat (2026-11-13)

A session that holds no seat finished a change (the species list's FASTA download) and met two
rules. The maintainer's global instructions say to "commit the changes and push them when the task is
done, without asking first", to "push to `main` directly and avoid pull requests", because "I mostly
work alone on my repositories". `CLAUDE.md` §2 left a push to the maintainer unless a seat's priming
granted it. Asked which holds, with the cost named (the push deploys the site), the maintainer
answered: "Push to main".

- **Decided:** where the maintainer's global instructions give that standing permission, a session
  without a seat pushes `main` to `origin` as a fast-forward once its task is done and checked
  (`CLAUDE.md` §2 and §8). The lead's grant (D1) is unchanged.
- **Rejected:** the work stays on its branch until the maintainer pushes it themself.
- **Its limit:** the question was put on one commit. That the answer stands for later sessions is the
  asking session's reading, said to the maintainer before the answer ("I'll record it in `CLAUDE.md`
  so the next session does not ask again"). Tags, releases, branch deletion and history rewriting stay
  the maintainer's.

## D3 — Parquet is the committed data format; derived tables are computed at site build (2026-11-13)

The maintainer, relayed by the lead seat on 2026-11-13: "I am fine with parquet writing".

- **What:** the site's data layer (`src/data/index.ts`) reads the committed parquet downloads in
  `public/data/` (species, region_stats, codon_usage, genome_features) with hyparquet at build time,
  keeping every DataApi signature. Only small JSON stays in `src/data/generated/` (build-info,
  taxonomy tree, dated phylogeny). Feature values, correlations (both datasets, PIC on the committed
  tree) and `explorer.json` are computed during `bun run build` and served from `dist/`
  (`/data/correlations.parquet`, `/data/explorer.json`), not committed.
- **Why:** with build 2 (2,335 species, about 2.5 times build 1) the committed JSON copies
  (`feature-values.json` 6.1 MB, `correlations.json` 5.3 MB in build 1) break the rule that no
  committed file exceeds about 5 MB; the parquet files are the downloads anyway, so the site reads
  one copy of the data instead of two.
- **Rejected:** Git LFS (needs LFS in the deploy workflow and on every clone, and moves the data out
  of plain git), and keeping the committed JSON copies (over the size limit, and a second copy of
  every value).

## D4 — No per-file size limit of our own (2026-11-13)

The maintainer, asked whether the 5 MB limit was a git or LFS restriction and told it was a CLAUDE.md
rule only: "so drop this rule".

- **What:** the rule "never commit a file over about 5 MB; larger files go through Git LFS" is removed
  from CLAUDE.md. The only limits left are GitHub's: it warns about files over 50 MB and rejects files
  over 100 MB. `pipeline/validate.ts` fails on a committed output file at 100 MB and warns at 50 MB.
- **Why:** the limit was not a constraint of git, GitHub or the deploy, and it forced work (D3's
  move away from committed JSON copies was partly driven by it) without a reason the maintainer holds.
- **Rejected:** keeping the 5 MB rule and handling large files with Git LFS or by splitting them into
  chunks. D3 (parquet as the committed format, derived tables computed at site build) stands on its
  own and is kept.


## D5 — Alignments of the mitochondrial genes, made with MAFFT (2026-11-13)

The maintainer asked whether multiple sequence alignments between the mitochondria of different species
could be prepared, used to find insights and offered on the site; then, before any pipeline work, "can you
check if smb already done and published". The check found no live resource with such alignments and one
site-level lifespan screen (Mariadassou & Pellay 2014). The maintainer: "That means we can start a research
arm (and a subchannel) on mitoalignments. I think we can do regular MSA and then we can check if we can do
structural alignments".

- **Decided:** each of the 13 proteins is aligned as amino acids, with the codon alignment it implies, and
  the two rRNAs as nucleotides, across the live species of the build; the files are committed under
  `public/data/alignments/` (`bun run align`). Structural alignment is checked afterwards, as its own item.
- **The aligner is MAFFT, an external program**, pinned by version, with the method named outright
  (FFT-NS-2). It is the one step of the pipeline that is not TypeScript: the code that calls it is, and
  the site build does not need it, since the alignments are committed. This was the lead's proposal, put
  to the maintainer as point 2 of the design and not objected to; the go was given on the design as a whole.
- **Rejected:** a whole-genome alignment (gene order differs between phyla, so its columns would not mean
  much), and an aligner written in TypeScript (far slower and worse on 2,300 sequences).

## D6 — The build is mirrored on Hugging Face; the site keeps building from git (2026-11-13)

The maintainer, on the alignments: "What size is it? Can we push it to hf as dataset?", then, on the
proposal below, "Go". Asked whether a columnar format exists for alignments ("Are there any modern parquet
or zarr like formats for MSA?"): none is a standard; the answer given was parquet with one row per species
and gene.

- The dataset is `longevity-genie/mitoage`, public, and holds the whole build: the data files as the site
  serves them, the alignments as FASTA and as one parquet table, and a card. One dataset matches one build.
- Its licence is stated as mixed: the lifespan values from FishBase and SeaLifeBase are CC BY-NC 4.0.
- `bun run hf` packages it; the upload is one command run by hand with the maintainer's login. Pushed with
  each build.
- The site builds from the files in git and reads nothing from Hugging Face.

Rejected: the alignments alone as the dataset (a second dataset would then be needed for the tables they
join to). The site reading its data from Hugging Face at build time or in the browser (the maintainer asked
"if mitoage overall cann serve hf data from static website or there are issues?"): possible, not done; the
build would need the network and the pages a pinned revision, and at 23 MB of data nothing presses for it;
that it works from the browser was not tested. A matrix store such as Zarr for the alignments: nothing to
gain at 2,316 rows. `alignments.parquet` in git: 22 MB more for a file made from files already there.

## D7 — The extended mtDNA features join the site's feature catalogue

**Decided (maintainer, 2026-11-14):** the extended mtDNA features are ordinary features of the catalogue, not
a parallel set with their own tables. `features_extended.parquet` and `correlations_extended.parquet`, which
the `mtdna-features` branch wrote, do not exist: the features are in `getFeatureDefs()`, so they flow into
`correlations.parquet` and the explorer payload like every other feature, and the pipeline commits only the two
per-species tables they are computed from (`mtdna_structure.parquet`, `protein_gene_features.parquet`).

**Rejected:** a second endpoint carrying the extended correlations, which would have been consistent with D3
but would have left two kinds of feature in one repository. Also rejected: keeping the branch's committed
`correlations_extended.parquet`, which contradicts D3 outright.

**What it costs, and was accepted:** the false discovery rate now runs over the combined set, so published
q values move; the picker needs entries for the new features before they are plottable (RM19); and the
explorer payload would have grown by about 2 MB had the features not been excluded from it until then.

**Why:** one feature set is simpler to explain than two, and the new features answer the same questions about
lifespan that the old ones do.

## D8 — The MCP server lives in this repository, in TypeScript (2026-11-15)

MitoAge gets a Model Context Protocol server. It is a directory of this repository, `mcp/`, a separate
npm package built and released on its own, and it is described in the paper as experimental.

- **Here, not a repository of its own.** The maintainer: "as mcp is more like an extra feature that we
  can say is experimental I assume we can just include it in ts to the website repo". A separate
  repository front-loads a CI, a README, issue triage and a release process on a feature that may find
  no users; a directory costs a workspace entry, and `git subtree split` moves it out later with its
  history if it earns one. **Rejected:** `dna-seq/mitoage-mcp` from the start.
- **TypeScript, not Python.** Section 3 of `CLAUDE.md` allows no Python here, and the server type-checks
  against `src/data/schema.ts` in the same `bun run check` as the site. **Rejected:** a Python server
  delivered by `uvx`, as `opengenes-mcp` and the other Longevity Genie servers are, which would have
  read as a sibling of theirs and given a `pip install` library for free; it would also have meant a
  second toolchain and a second repository.
- **SQLite, not the parquet.** `correlations.parquet` is 203,648 rows and 56 MB as Arrow; a resident
  server should not carry that, and an indexed SQLite answers a lookup at constant memory with no
  native dependency in either language (`node:sqlite` is built in from Node 24; Python's `sqlite3` is
  stdlib). **Rejected:** reading the parquet with hyparquet, and DuckDB — whose npm binding has 61
  published versions and not one without a prerelease suffix.
- **Pinned to a dataset revision, never to a branch.** A database that is cited has to give the same
  answer tomorrow. The release workflow refuses to publish while the revision is unset or is not a full
  commit SHA, and the server refuses to start rather than fetch the newest file. **Rejected:**
  following `main` of the dataset, which is how the file would otherwise be fetched.
- **No tool returns a correlation coefficient alone.** Every one carries its q-value and both controls,
  with the verdict using the definitions the manuscript's Table 3 uses (`q < 0.05`; `pic_p < 0.05` with
  the same sign; `partial_p < 0.05`, the sign said beside it). **Why:** the re-analysis this release is
  about says most raw correlations do not survive those controls, and an agent handed the raw table
  reproduces exactly that error.

**What it costs, and was accepted:** a second package in a repository that had one, and a Node
prerequisite for anyone who takes the Longevity Genie servers as a set.

## D9 — The Hugging Face upload was run in-session, amending D6 (2026-11-15)

D6 says the upload is run by hand. The maintainer instructed otherwise during the MCP work ("I command
you to do upload on my behalf", and then the command itself), and the upload of build 2 with
`mitoage.sqlite` was run from the session with the machine's stored login. **D6 stands as the default**;
this records the one run and the conditions it was done under, rather than changing the rule.

- **The credential was never handled by the session.** No Hugging Face credential is configured in the
  assistant's credential store and none can be requested there (`openalex` and `github` only). The
  machine's own login was resolved by `huggingface_hub` from `HF_HOME`; the token was not read, printed
  or copied. The pipx-installed `hf` CLI could not run at all (`ModuleNotFoundError: huggingface_hub`),
  so the client library was used instead, with the same effect as D6's command line.
- **The upload was verified before anything was pinned to it.** Revision `c525adbff8c12b19981fdada7f1615c2559b7140`,
  79 files; `mitoage.sqlite` 113,618,944 bytes with the hub's LFS SHA-256 equal to the local file's.
- **Rejected:** reading the token out of `~/.cache/huggingface/` to pass it in by hand. A secret is used
  through the client that owns it or not at all, whoever asks.

**What it costs, and was accepted:** one upload whose provenance is this entry rather than a shell
history. The next one follows D6 unless the maintainer says otherwise again.

**A second upload under the same conditions (2026-11-15), the build with the EURING birds.** The maintainer: "Yes,
upload and rerun". Revision `f75bdc9b812d7845d2ccb24a49643d88d00d57b5`, 78 files, packaged on haumea in a fresh
clone of fb54cec (`/data/uq2347/runs/mitoage/site-main`: `bun run build`, `bun run hf`, `bun run sqlite`, Slurm job
6489879) and uploaded through `huggingface_hub` with haumea's stored login, the token not read. Verified file by file
against the hub: LFS SHA-256 equal; `mitoage.sqlite` 116,387,840 bytes, SHA-256 62dd4d871643b0c7…. Its
`species.parquet` (4e4aab66ae53…) is the file the cluster reruns of round v0.3 read (mitoage-pipelines
`results/euring/`, job 6489877). Round v0.3 cites this revision; D17 records the next one.

## D10 — The contrast t test stays the published PIC test (2026-11-15)

`docs/PIC_CALIBRATION.md` found the contrast code correct (it matches R `ape::pic`) and its t test exact
under Brownian motion, but over-rejecting where one sister pair dominates a scope's contrasts. Told that a
sign-flip test would give 531 of 4,299 "Both" instead of 896, the maintainer: "than keep it, we should not
overdrop tings". **`pic_p_value` stays the t test with m − 1 degrees of freedom, and the table's and the
manuscript's PIC, Both and All-three counts (3,008, 896, 547) stay as they are.**

- **Rejected:** replacing `pic_p_value` by the sign-flip p value (PIC 1,255, Both 531, All three 336). It
  drops results in Mammalia too (Both 164 to 153), where the two tests agree on calibration.
- **What it costs, and was accepted:** the fish scopes' contrast rejections (Chondrichthyes 585 of 1,368,
  Rajiformes 74 of 191, Clupeiformes 70 of 200, Actinopterygii 546 of 1,402) are known to include chance: with
  lifespan shuffled across species the same test rejects 22–33% there. Of the 205 FDR-passing all-species
  correlations significant on contrasts with the opposite sign, 50 remain under the sign-flip test. Both
  referee panels raised the calibration; the report and its per-test sign-flip p values
  (`docs/analyses/pic-calibration/`) are the answer kept on file.
- **Both are published (2026-11-15):** asked whether the pipeline can choose the test, the maintainer chose to
  carry both: "2" (a `pic_signflip_p` column beside `pic_p_value`, so the methods can say both were run). The
  t test stays the one the counts above use; `pic_signflip_p` is there for every lifespan row to be read beside it.

## D11 — Lifespan with and without body mass, reported side by side (2026-11-15)

`docs/PIC_CALIBRATION.md` asked whether the paper should report the contrast result with body mass partialled
out, the one without it, or both; its recommendation was both. Asked which, the maintainer answered: "Both,
side by side".

- **Decided:** every lifespan row of `correlations.parquet` carries `pic_mass_r` and `pic_mass_p_value`, the
  contrast correlation with log10 adult weight partialled out (`partialContrastCorrelation` in
  `pipeline/lib/stats.ts`, df = m − 2, at least 10 species with a weight, as for `partial_r`). Table 3 and
  Supplementary Table S1 gain a column "PIC + mass" beside the funnel (393 of 4,299 in the default dataset);
  the funnel's counts (896, 547) and D10 are unchanged.
- **Rejected:** reporting only the mass-corrected result, which would hide that most of the signal is shared
  with body size; and only the uncorrected one, which would overstate what is specific to lifespan (the
  calibration report's reasons).
- **What it costs, and was accepted:** a fourth count beside the three controls, and two more columns in the
  table. The combined test uses the t test and inherits the over-rejection of the fish scopes (D10); it gets
  no sign-flip p value.

## D12 — TimeTree's ages and answers stay published as they are, for now (2026-11-15)

The run `20261115T132217Z-c1672440` (policy fit, finding PF-1; dashboard decision D1) found that the timetree.org
footer, read 2026-11-15, says redistribution of TimeTree data and its transformations is not permitted and that the
data are open for personal research and teaching use. MitoAge 2 publishes the raw TimeTree answers (Hugging Face
`longevity-genie/mitoage-build2-sources`) and the dated tree built with them (`src/data/generated/phylogeny.json`),
and `pipeline/build.ts:251` and the downloads' README call TimeTree a "Free public resource". Asked to choose, the
maintainer chose "Leave the text as it is".

- **Decided:** no change now to the manuscript, the published files or the licence text; the conflict stays open.
- **Rejected:** withdrawing the answers and the node ages and publishing a fetch command, with a request to TimeTree
  for permission (the recommendation); asking TimeTree while keeping the files public; re-dating the tree from an
  openly licensed source (new analysis).
- **What it costs, and was accepted:** the redistribution stays outside TimeTree's stated terms, and a referee or
  TimeTree may raise it; "Free public resource" remains in the build's source list.

## D13 — The sign-flip count gets its own column in Table 3, amending D10's presentation (2026-11-15)

The v0.3 run's referees (SW-1 to SW-3, SK-1, SK-8, CH-1, SKX-1; dashboard decision D2) asked how far to go beyond D10,
since the contrast t test over-rejects with lifespan shuffled (29% in all species, 22-33% in the fish scopes) and the
sign-flip count stood only in sentences. The maintainer chose "Add a sign-flip column to Table 3".

- **Decided:** Table 3 and Supplementary Table S1 gain "Both (sign-flip)" beside "Both": FDR, and `pic_signflip_p`
  < 0.05 with the same sign (533 of 4,299 over the 32 scopes; all species 106, mammals 153), read from the published
  `correlations.parquet` of main's build. The t-test counts stay the headline (896, 547), as D10 decided; Figure 1
  is unchanged.
- **Rejected:** keeping the count in sentences only; making the sign-flip test the headline (reversing D10, with no
  sign-flip version of the 393); recomputing every test as phylogenetic regression with Pagel's lambda on the cluster.
- **What it costs, and was accepted:** a tenth column in Table 3. In a few small scopes the sign-flip count exceeds
  the t-test one (Primates 11 against 8), since the two p values differ in both directions.

## D14 — The site and the manuscript say GC/AT balance; the data files keep `gc_skew` and `at_skew` (2026-11-15)

The maintainer, on the v0.3 abstract: "usually people do not use skewer as term in mito papers and just use CG ratios
or something", then "Rename to GC/AT balance" for the manuscript and "Rename them too" for the site and the data.
Asked how far the rename goes, with the cost of renaming the identifiers named, the maintainer chose "Labels only".

- **Decided:** (G−C)/(G+C) and (A−T)/(A+T) are the GC balance and the AT balance wherever a person reads them: the
  manuscript and its supplement, the site's labels, columns, chart axes, feature names ("GC balance of ND6") and page
  text, the README, and the MCP server's tool descriptions. The About page and the supplement say they are often
  called the GC and AT skew, the name the downloads keep.
- **Rejected:** renaming the identifiers too (the `gc_skew`/`at_skew` columns, the `gcSkew:` feature keys, the
  `skew` feature group). That would need a new data build, a new Hugging Face revision uploaded by hand and the
  manuscript's cited revision changed, mitoage-pipelines changed in step (its reproduction compares the tables by
  column), an MCP release, and it would break shared plot links that carry the old keys.
- **What it costs, and was accepted:** the downloads, the CSV exports and the plot URLs still say skew, documented
  on the About page and in the supplement.

## D15 — The EURING list is read from the Internet Archive's copy (2026-11-15)

euring.org has redirected every page to a maintenance notice since at least 2026-11-13, so build 2 used no
EURING value and its 26 USGS-sourced birds were flagged provisional (RM5). The list of 2023-09-01 is a PDF
(`EURING_longevity_list_20230901.pdf`); the Internet Archive holds captures of it from 2023-12-16 to
2026-10-11, all with one SHA-1 digest. Offered the archived copy, the maintainer chose "Use the snapshot".

- **Decided:** the pinned EURING input is the archive's capture of 2026-10-11, fetched from its raw (`id_`)
  URL, its SHA-1 checked against the archive's digest and its md5 pinned in `pipeline/sources/pinned.ts`. The
  PDF is read by `pipeline/lib/pdf-text.ts`, a small reader for spreadsheet-exported PDFs that refuses
  anything it cannot decode, and parsed by `pipeline/sources/euring.ts` (776 records of 399 species).
- **Rejected:** waiting for euring.org (RM5's date, 2026-11-20, with no sign the site returns); leaving
  EURING out of the precedence; reading the PDF with `pdftotext` (a second external program, against the
  TypeScript-only rule that admits MAFFT alone) or with `pdfjs-dist` (a new dependency).
- **What it costs, and was accepted:** 9 European birds with a RefSeq mitogenome and no AnAge lifespan join
  build 2 (2,335 → 2,344 species; `default` correlation dataset 2,202 → 2,211), so every count and
  correlation of the build moves a little. None of the 26 USGS birds is on the list: their values stay and
  lose the provisional flag. The list states no licence; it is cited as Fransson, Kolehmainen, Moss &
  Robinson (2023). Ages are minimum ages; one cell ("11y im", a quail's second record) keeps its whole
  years.

## D16 — The t test keeps the headline; every count gets chance bounds beside it (2026-11-15)

The v0.3 skeptic called the counts "uncalibrated" (`docs/REVIEW_ANALYSES_PLAN.md`, question 1). Offered three
answers, the maintainer chose "t test + chance bounds".

- **Decided:** Table 3, Supplementary Table S1 and the abstract keep the contrast t test's counts as the
  headline (D10, D13 unchanged). Every count gets, beside it, the number of passes expected by chance in its
  scope: an upper bound from shuffled lifespan and a lower bound from Brownian lifespan on the tree (the plan's
  A1). The sign-flip column stays.
- **Rejected:** a calibrated count as the headline (the sign-flip count, or the phylogenetic permutation's once
  run), which would have amended D10 and D13 and taken the all-species "Both" from 292 to 103 and the
  abstract's "one in five" to about one in eight; and all counts side by side with no headline.
- **What it costs, and was accepted:** one more column in Table 3 and S1. A count whose upper chance bound
  reaches half of it is printed but not interpreted, the plan's reading rule fixed before the bounds are
  computed; the fish scopes are expected to fall there.

## D17 — A third in-session Hugging Face upload, on the maintainer's instruction, amending D6 once more (2026-11-15)

After the gene-annotation patch (03c0949), the maintainer: "upload on my behalf you have my hf key". The build was
packaged on the laptop (`bun run hf`, `bun run sqlite`) and uploaded from the session as under D9 (after f75bdc9, the second): `huggingface_hub` resolved the
machine's stored login itself, and the token was not read, printed or copied.

- **Done:** revision `0f4e970554b2fe0265e718321f422347293dde17` of `longevity-genie/mitoage`, the 78 files of
  `out/hf/`. Every file was checked against the local copy after the upload (the hub's LFS SHA-256, or the git blob
  hash for small files): 0 mismatches. Against f75bdc9 only the files the patch touches changed (the seven data
  tables, `species.csv`, the ND6 alignments and `alignments.parquet`, `mitoage.sqlite`, the two READMEs and
  `alignments.json`).
- **Not changed:** round v0.3 keeps citing f75bdc9 (the build it describes), and the MCP server stays pinned to
  c525adb until a release moves its pin (D8; tags are the maintainer's).
- **D6 stands as the default**, as D9 left it: the next upload is by hand unless the maintainer says otherwise.
