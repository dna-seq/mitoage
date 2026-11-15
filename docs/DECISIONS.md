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
