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
