# mitoage-mcp

**Experimental.** An MCP server for [MitoAge](https://www.mitoage.info): the mitochondrial genomes of
2,335 animal species against their maximum lifespan — base composition, codon usage, genome
annotation, structural features, life-history traits, and the correlations between them.

The access route to cite is the downloads: the Parquet and CSV tables under
<https://www.mitoage.info/data/> and the Hugging Face dataset
[longevity-genie/mitoage](https://huggingface.co/datasets/longevity-genie/mitoage). This server is a
second route, for an agent that would otherwise fetch a table and correlate two columns itself.

## Why the tools work the way they do

Across MitoAge's mtDNA features, **most raw correlations with lifespan do not survive the controls**:
the Benjamini–Hochberg false discovery rate, a partial correlation on body mass, and a correlation on
phylogenetically independent contrasts. Whole-genome GC content against maximum lifespan in mammals is
r = 0.47 raw and r = 0.17 on contrasts.

So no tool here returns a bare r. Every correlation comes back with its q-value, both controls, the
filters of the dataset it was computed on, and the build it is from — plus a plain verdict saying
which controls it survives, and saying "not assessed" where a control was never computed rather than
reporting it as a failure.

Every number is a row the published build wrote. The server computes no statistic of its own; the one
tool that aggregates (`region_summary`) says so in its answer.

## Install

Needs Node 24 or newer (for the built-in `node:sqlite`). Tested on Node 26.13.0.

```json
{
  "mcpServers": {
    "mitoage": {
      "command": "npx",
      "args": ["-y", "mitoage-mcp"]
    }
  }
}
```

On first run the server downloads one SQLite file (about 114 MB) from the pinned revision of the
Hugging Face dataset and caches it under `$XDG_CACHE_HOME/mitoage-mcp/<revision>/`. The revision is a
commit, never a branch: a database that is cited has to give the same answer tomorrow.

| Variable | What it does |
| --- | --- |
| `MITOAGE_DB` | Path to a `mitoage.sqlite` already on disk. Nothing is downloaded. |
| `MITOAGE_REVISION` | A commit of the dataset to fetch instead of the pinned one. |

If this version is not pinned to a revision yet, the server stops and says so; set one of the two
variables. It never quietly falls back to the newest file.

## Tools

| Tool | What it answers |
| --- | --- |
| `build_info` | Which build, how many rows per table, the filters of each correlation dataset, every source with its version and licence |
| `search_species` | Species by scientific name, common name or slug, longest-lived first, optionally within a class, order, family or genus |
| `species_profile` | One species: its record, every region of its mitogenome, its structural features, and every lifespan observation with its source |
| `correlation` | One feature against one trait: r, rho, p, q, partial r on body mass, r on contrasts, and the verdict |
| `rank_features` | The features of a trait and scope, strongest first, each with its controls; `only_surviving` keeps those that pass the FDR and hold on contrasts with the same sign |
| `region_summary` | Counts, means and ranges of GC %, the skews and the length across the species of a scope |
| `query` | One read-only SQL statement against the build |

A scope is `all`, or a rank and a name as the build spells it: `class:Mammalia`, `order:Primates`,
`family:Balaenidae`.

## Licence and citation

The server is MIT. The data are mixed: lifespan values from FishBase and SeaLifeBase are CC BY-NC 4.0,
and every species row carries its `lifespan_license`. AnAge data are subject to the Human Ageing
Genomic Resources conditions of use; NCBI data carry no use restrictions. `build_info` returns the
licence of every source.

Cite: Toren D, Barzilay T, Tacutu R, Lehmann G, Muradian KK, Fraifeld VE. MitoAge: a database for
comparative analysis of mitochondrial DNA, with a special focus on animal longevity. *Nucleic Acids
Res.* 2016;44(D1):D1262–5. doi:10.1093/nar/gkv1187 — and the sources of the values you use.

Built from <https://github.com/dna-seq/mitoage>, where the server lives in `mcp/`.
