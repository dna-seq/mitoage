# Agent Guidelines — MitoAge

The static website and data pipeline of MitoAge, a database for comparative analysis of mitochondrial DNA with a focus on animal longevity; not a server application, and not the 2015 site's code.

`AGENTS.md` is a symlink to this file. If the two ever differ, that is a bug —
`ln -sf CLAUDE.md AGENTS.md`.

---

## Read these first, in this order

Obligatory. Read them yourself. **Do not delegate a document you are about to judge a design
against**: a subagent returns a summary, and a summary of a rule drops the qualifier the decision
turned on. Delegation is for finding things, never for deciding them.

1. **docs/ROADMAP.md** — open work only, in order.
2. **docs/CHANGELOG.md** — what actually landed, newest first.
3. **docs/DECISIONS.md** — the calls settled with the maintainer, each with the alternative it
   rejected.

A charter, when the repository keeps one (a format or a schema, whose invariants outrank any plan),
goes first in this list and wins any conflict with a plan. A per-area reference goes last, read
when the task touches its area.

Everything below is self-contained: no rule here requires following a link to know what you must
not do. Links carry positive detail only.

**The `.claude/` layer is part of this repository's contract.** Its skills, agents, commands and
hooks are named here, each with a line saying what it is for, or they are found by accident. Where
a skill is the canonical copy of a procedure, this file says so in one line and does not restate it.
None existed when this file was written.

Sessions that take a standing role (a seat) all load this file; each seat's own priming lives under
`docs/seats/`, and the seats kit runs them.

---

## 1. When rules conflict: ask, never infer

When two rules conflict (this file against a sibling repository's, against the person's global
preferences, a rule against what the code does), stop and ask. Do not pick the one that looks
better, do not synthesise a compromise, do not silently follow the more specific file. A conflict
between two live rules is almost always a real difference in what the repositories are, and
inferring which applies here is the guess that produces a rule nobody agreed to.

1. **Survey first, ask second.** Read both rules whole and find out why each side holds its
   version. A question that does not carry the reason cannot be answered.
2. **One question per conflict, batched**, never dripped. Each gets two to four concrete options.
3. **Each option states its cost**: what breaks, what it forces elsewhere, which rule it
   contradicts.
4. **Recommend one, and say so.**
5. **Record the answer where it will be read again**: the rule into its section below, the reason
   into §8 in the maintainer's own words, the call into `docs/DECISIONS.md` with the alternative it
   rejected. An answer not written down gets asked again.

A conflict with the charter is not a question: the charter wins.

**Adopting this file is such a moment.** It was laid by the seats kit's `bin/init.py`, and the
sections marked "Not yet written" have more than one right answer. The questions to ask before the
first change: the build, run and test commands; the layout beyond `docs/`; the dependency tier the
code may carry; whether consumers report to this repository (then it keeps a consumer inbox,
which the kit's triage role runs) and which repositories it consumes; whether a `git pull` into it
can break a user's install (then a STOP banner goes at the very top of this file, with the
sentence to hand the person); the sibling repositories, read-only unless the task targets them.

---

## 2. Non-negotiables

Read the whole list before the first edit. The reason follows each rule, because a rule without its
reason gets argued away at 2 a.m.

- **Never claim a test would have caught a bug without running it against the buggy code** and
  watching it fail. A new test is checked by breaking the code it guards.
- **Never silently fall back when the primary input is missing.** Refuse, or say loudly what was
  substituted: the person cannot see that the source differs.
- **Never fill a value from the same source that checks it.** The check then compares a source with
  itself and agrees perfectly, and the value moves from honestly unverified to apparently verified.
  A lookup reports, the person decides, the check checks; a refusal a tool prints is kept verbatim.
- **Never collapse unknown into yes or no.** A check that could not run is not a check that passed;
  a timeout is not a negative answer. Unknown is said as unknown.
- **Never read a reproducible result as a correct one.** A digest match, a strict mode, a
  reproducible build say the bytes came out the same, not that they mean what was intended.
- **Never commit a placeholder path or a made-up example value.** It proves nothing and outlives
  the session that invented it.
- **Never track `.leak_words` or `.leak_allow`.** They name everything the leak gate protects
  (copy `.leak_words.template` to `.leak_words` and fill it; the kit's `bin/leak-gate.sh install`
  turns the gate on). Never commit with `--no-verify`.
- **Git: commit as you go**, one coherent block per commit: a behaviour with its test, doc and
  changelog line. No conventional-commit prefixes. Stage explicit paths, never `git add -A` or
  `git add .`: they sweep in secrets, editor swap files and junk. Local branches are free to create
  and switch. No push, tags, releases, branch deletion or history rewriting: those are the
  maintainer's, unless a seat's priming grants one in writing, by name. One exception (D2): where
  the maintainer's global instructions give a standing permission to push, a session without a seat
  pushes `main` to `origin` as a fast-forward once its task is done and checked (`bun run check`,
  `bun test`, the build as the workflow runs it and its link check); that push deploys the site.
  Never `git stash drop` or `git stash clear`, even on request.

---

## 3. Layout

```
src/         the site: pages, components, styles, lib, and the data contract (src/data/schema.ts)
pipeline/    the data pipeline (bun run data): sources, steps, lib, validate.ts, tests
public/      static assets; public/data/ holds the downloads the pipeline writes
docs/        all new markdown except this file and README.md; docs/seats/ holds the seats' primings
plans/       plans and handoffs written before this file (DATA_BUILD2_DECISIONS.md, handoffs/)
.github/     workflows/deploy.yml: every push to main builds and deploys the site
```

`README.md` describes the code under `src/` in detail (routes, components, the design system) and is
kept true in the same commit as a change to what it describes. `plans/` predates the rule of §6 and
stays where it is; a new document goes under `docs/`.

Everything is TypeScript, the pipeline included: no Python and no plain JavaScript in the repository.
One external program is called by the pipeline: MAFFT, for the alignments, at a pinned version (D5).

The pipeline's output is committed (`src/data/generated/`, `public/data/`), so the site builds on a
clone without the raw inputs; the inputs (`data/input/`) and the download cache (`data/cache/`) are
not in git. Generated files are written by `bun run data` only, never edited by hand.

---

## 4. Build, run, test

Runs on Bun. Every entry point (`README.md`, "Commands", has the same table):

| Command | What it does |
| --- | --- |
| `bun install` | install dependencies |
| `bun run data` | run the data pipeline, writing `src/data/generated/` and `public/data/`; it needs the raw inputs, which are not in git |
| `bun run align` | align the mitochondrial genes of the committed build with MAFFT, writing `public/data/alignments/`; it needs MAFFT at the pinned version and the pinned RefSeq release in `data/cache/` |
| `bun run hf` | package the committed build for Hugging Face into `out/hf/` (the data files, `alignments/alignments.parquet`, the dataset card); the upload is run by hand, `hf upload longevity-genie/mitoage out/hf . --repo-type dataset` (D6) |
| `bun run dev` | dev server |
| `bun run build` | build the static site into `dist/` |
| `bun run preview` | serve `dist/` locally, with the same `BASE_PATH` as the build |
| `bun run check` | type-check `.ts` and `.tsx` (`.astro` files are not covered) |
| `bun test` | unit tests |

**A push to `main` deploys the site** (`.github/workflows/deploy.yml`), built with
`SITE_URL=https://just-dna.life BASE_PATH=/mitoage`. The workflow fails on any root-absolute link
without the base path, so every internal URL goes through `href()` (`src/lib/url.ts`).

**Run the commands yourself** rather than telling the person to run them, except where a command
needs an interactive terminal: then hand over the exact line.

---

## 5. Code and tests

- **A result that can be unknown says so.** Yes, no and unknown are three answers; when "no" has
  kinds (a refusal, a timeout, a crash, a malformed input), the answer carries which.
- **Ordering is load-bearing** wherever bytes are hashed, compared or shipped: never emit in the
  order of a set or a map without a stable sort.
- **Aggregate a warning raised in a loop**: by reason, once, with a count.
- **Timestamps are stored as ISO-8601 UTC** and shown in local time.
- **A deprecation warning in code you touched is a blocker**: the API moved; fix it, and the rule
  here, so the pattern does not return.
- **Internals are free to change; the contract is not.** The public API, the shape of what is
  written or sent and the command line change only on purpose, and with a version.
- **Tests run the real code path on real data** and compute the expected values from the fixture
  at run time. Never mock the transformation under test. Assert relationships (set equality, sums,
  round trips) over existence or counts, and cover the edges: empty, null, a boundary, malformed
  input.

---

## 6. Docs and their lifecycle

- **All markdown goes in `docs/`**, except this file and `README.md`. Every file under `docs/` is
  named in UPPER_SNAKE; directories stay lowercase.
- **`docs/` is the ground truth.** This file repeats from it only what orients a reader, and every
  prohibition lives here in full: a "don't" behind a link does not get read.
- **`docs/ROADMAP.md` holds open work only.** Done items leave it; the changelog says what landed.
- **`docs/CHANGELOG.md`** records what landed, newest first, in the same commit as the change,
  including a change made here to follow a repository this one consumes.
- **Update the affected docs in the same commit as the change**, never after.
- **Something that belongs to a repository this one consumes but does not own** is reported to
  that repository's inbox (its issues, or its consumer inbox), restated in its terms, never filed
  into its roadmap, and its repository is never edited or committed to. Our side of it goes into our
  changelog.
- **Before a pull request**, show `git diff <upstream>/main --stat HEAD` and
  `git log <upstream>/main..HEAD --oneline` and wait for approval. Files of one installation (local
  settings, local configs) stay out.
- **Prose is plain and honest.** Never describe a capability the repository does not have.

---

## 7. Self-correction

When outdated knowledge of an API causes a real failure, fix the code and the rule here (and the
affected `docs/`), so the next session does not repeat it. When the maintainer corrects a
preference, it goes into §8 in their words, with the reason.

## 8. Learned

Append-only, one line each: the maintainer's preferences in their own words, and the facts of this
machine and this project that reading the code does not reveal.

- 2026-11-13, the maintainer, on the adoption's pull request: "so far no need of pr-s as I am th main
  developer". Work lands on `main` directly, as a fast-forward push where a seat's grant covers it; a
  pull request is opened only when the maintainer asks for one.
- 2026-11-13, the maintainer, asked which rule holds for a session without a seat, the global
  instructions' "push to `main` directly and avoid pull requests" or §2's push by a seat's grant only,
  with the cost named (the push deploys the site): "Push to main". The reason is the global
  instructions' own: "I mostly work alone on my repositories". The question was put on one commit; that
  the answer stands for later sessions is the asking session's reading, announced before the answer.
- 2026-11-13, the maintainer, relayed by the lead: "I am fine with parquet writing". The committed data
  is parquet (`public/data/`), read by `src/data/index.ts` at build time; derived tables (feature
  values, correlations, explorer.json) are computed during the site build, never committed (D3).
- 2026-11-13, the maintainer: "so drop this rule" (the 5 MB per-file limit). GitHub itself warns at 50 MB and rejects files over 100 MB; those are GitHub limits, not a project rule.
- 2026-11-13, the maintainer, once headless screenshots of the built site worked on the cluster: "you can
  also do visual work on cluster and post screenshots to zulip as proofs of changes". A change a visitor
  sees is posted in the repository's channel with its screenshots, a phone's and a desktop's width.
