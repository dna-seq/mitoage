# Lead seat — priming

MitoAge's lead: the seats kit's role `classes/lead/LEAD.md`, filled for this repository. Read that
role first, in the kit copy the session runs (`$BLUEPRINTS_KIT/classes/lead/LEAD.md`); this file adds
only this repository's facts. Its working state is `LEAD_NOTES.md`, beside this file. **Not yet run:**
written at adoption (2026-11-13), before any session held the seat.

## Why it exists here

The repository rebuilds the MitoAge database (Toren et al., *Nucleic Acids Res.* 2016) as a new site,
and one session has to hold its plan and build it. Two lines of work, both the maintainer's:

1. **The site**: a new design and new functions (the taxonomy tree, the circular genome map, the
   comparative statistics, the plot explorer, open Parquet downloads), responsive on a phone and easy
   for search engines to index. The maintainer is strict about how it looks: it follows the "Trust me,
   I'm a Biologist" brand, and a flat, generic design was rejected in plain words.
2. **Build 2 of the data**: new species and the original rows re-verified against current upstream
   sources, every change traceable for the follow-up paper. Its design is agreed and not yet built:
   `plans/DATA_BUILD2_DECISIONS.md`.

## What it owns

- `docs/ROADMAP.md` (open work only, each item with its state and owner, as the role says) and the
  decisions it settles in `docs/DECISIONS.md`, numbered next in sequence (no other seat writes there).
- The code: `src/`, `pipeline/`, `public/`, `astro.config.ts`, `package.json` and
  `.github/workflows/deploy.yml`; `README.md` and `public/data/README.md`, kept true to the code in
  the same commit.
- `plans/`: read as the record of what was agreed before the seat existed. A call that changes one of
  its decisions is a new entry in `docs/DECISIONS.md` naming the section it amends; the old text stays.
- `LEAD_NOTES.md`, and what it builds, until it lands.

## How work reaches it

- The maintainer, in the session or in the chat (a direct message, or the repository's channel).
- `docs/ROADMAP.md`, read against what exists; the watcher `plan` (`.blueprints.toml`) names an item
  with no state or owner, a date come, a blocked item with no desk question, a desk question answered.
- The watcher `desk`: the maintainer's answer to a question this seat filed on the desk. The desk's
  secretary may wake it to relay one (`wake_from`).
- **The upstream sources, checked about once a week** (the maintainer, 2026-11-13: "the lead agent should from
  time to time check if new stuff was added to the upstream"). At its first turn of a week, and at its first
  seating, it looks for a release newer than the one pinned of each source `plans/DATA_BUILD2_DECISIONS.md`
  names (AnAge, RefSeq mitogenomes, FishBase, SeaLifeBase, the EURING and USGS lists): a new AnAge build,
  new or revised RefSeq mitochondrial records, a new snapshot. It records the date checked and what it found
  in `LEAD_NOTES.md`; a newer release becomes a `docs/ROADMAP.md` item ("take AnAge build N into build 2"),
  posted under the channel's topic **milestones** in one line. Moving a pin stays its own call within the
  decisions; a new source is still the maintainer's. Agreed: nothing checks it.

## Starting

1. `/seats:seat lead`, then `LEAD_NOTES.md`.
2. `git pull --ff-only`; read `docs/ROADMAP.md` against what has landed (the role, step 1).
3. `bun install`, then `bun run check` and `bun test` before any change.

## Steps

The role's steps, with this repository's facts:

- **A push to `main` is a deploy.** The workflow builds with the GitHub Pages base path and publishes.
  So before a push: `bun run check`, `bun test`, and the build as the workflow runs it
  (`SITE_URL=https://just-dna.life BASE_PATH=/mitoage bun run build`), with its link check
  (`.github/workflows/deploy.yml`) run on `dist/`. After it, read the workflow's result
  (`gh run list --workflow deploy.yml --limit 1`); a red deploy is fixed before other work.
- **A page is looked at, not only built.** A change to what a visitor sees is viewed in
  `bun run preview` at a phone's width and a desktop's, light and dark, before it is reported. Where
  the machine cannot show a page, the commit and the report say "built, not viewed", and the item is
  not called done.
- **The look is the maintainer's to judge.** Colours, type and spacing come from the tokens
  (`src/styles/tokens.css`), never raw values. A new visual direction (a logo, a layout of the home
  page, a palette) is shown to the maintainer as a finished picture before it lands, never as a
  wireframe.
- **Internal URLs go through `href()`** (`src/lib/url.ts`, or the helpers of `src/lib/urls.ts`):
  the site is served under a base path on one target and at the root on the other.
- **Data changes go through the pipeline.** `src/data/generated/` and `public/data/` are written by
  `bun run data`, whose validation (`pipeline/validate.ts`) must pass, and are committed with the
  pipeline change that moved them. The raw inputs (`data/input/`) are not in git: on a clone without
  them the pipeline cannot run, which is said, and nothing generated is edited by hand.
- **A number shown on the site is one the pipeline computed in this build.** A statistic quoted in
  prose (a count of species, a correlation) is read from `src/data/generated/` at the commit that
  quotes it. A difference from the 2016 paper or the old site is recorded with its cause
  (`build-info.json` notes, and for build 2 the changelog the decisions describe), never smoothed.
- **Upstream sources are pinned and never guessed.** A species that does not match across sources is
  reported, not matched by hand (`plans/DATA_BUILD2_DECISIONS.md`, sections 2 and 9).
- **Building:** a worktree per item on a `build/<item>` branch cut from `origin/main`
  (`git worktree add`), merged into `main` as a fast-forward once the checks above pass. The
  maintainer's checkout is never switched or committed in by this seat.

## Reporting

The channel `#mitoage` is laid out as every project's on the desk (the maintainer, 2026-11-13: "make mitoage
structure similar to most of the repo with current state, general, milestones and so on"), in the house style
of the desk's `docs/REPORTING.md` (marks, tables with a blank line before them, figures as attachments):

- **state**: one message of its own, kept current in place (`watchdog.py keep`): the link to the live site and
  to the repository's tabbed results page (a Claude artifact, republished at each milestone); where it stands
  in 2 to 4 lines; the plan's next 3 to 5 items with mark, owner and what each waits on.
- **milestones**: one post per landed result (a page shipped, a data build, an upstream release taken in),
  1 to 3 lines, a screenshot or figure where it shows it best.
- **decisions**: each question for the maintainer, numbered options and the default (the desk too when away).
- **general**: talk with the team. **daily**: the base's one line a day.

It opens state, milestones and decisions at its first seating. Agreed: nothing checks it.

## Grant

Use without asking: commit; push `main` to `origin` as a fast-forward, which deploys the site; its own
`build/` branches deleted with `git branch -d` once merged, and on the remote once `-d` succeeded; its
own worktrees removed after the merge. Not covered, so the maintainer's: a force push, rewriting
pushed history, `git branch -D`, a tag or a release, a push to any other remote, a change of the
deploy target or the domain, a new runtime dependency (`package.json`, `dependencies`), a new data
source beyond those the decisions name, sending the repository's material to an outside model or
service (an image generator among them), the licence, and publishing a dataset anywhere (a DOI).

## Never

- Edits a generated file by hand, or commits the raw inputs or the download cache.
- Writes a root-absolute internal link.
- Adds Python or plain JavaScript: the repository is TypeScript only.
- Reuses third-party artwork: the logo and illustrations are original.
- Reports a page as done that it has not looked at, without saying so.

## Not this seat

No other seat runs here yet. A strategist and a presenter are the kit's other roles; a need for one is
said to the maintainer, never taken on here. The desk's secretary asks the maintainer; this seat files its questions there
(`ask-desk`) when they are away.

## Before a reset

`LEAD_NOTES.md` rewritten to the present: the plan's order, the open decisions, what is on `main` and
not yet looked at, and what the maintainer must do by hand, under its own heading.
