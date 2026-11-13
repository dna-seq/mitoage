# MitoAge build 2: data extension and provenance decisions

**Date:** 2026-11-13
**Status:** agreed with the owner (interview), not yet implemented

Context: build 1 is the 2015 dataset published in Toren et al., Nucleic Acids Res. 2016;44(D1):D1262-5
(922 species after excluding *Loxioides bailleui*). Build 2 extends it with new species and re-verifies
the original rows against current upstream sources. Every change must be traceable for the follow-up paper.

## 1. Inclusion rule

Original rule kept: a species with a complete RefSeq mitochondrial genome and a maximum lifespan from a
curated source. Extended: lifespan may come from additional sources that are curated and regularly
maintained. Static one-off compilations (Amniote database, AmphiBIO, COMBINE, PanTHERIA) are excluded
under the "regularly maintained" rule.

Mitogenomes: RefSeq only (no non-RefSeq GenBank records in build 2).

## 2. Lifespan sources and precedence

AnAge is always primary. A secondary source fills `max_longevity_years` only when AnAge has no value.
Fixed priority per taxon:

| Taxon | Priority |
|---|---|
| All | AnAge (build 15, pinned) |
| Actinopterygii, Chondrichthyes, other fish | AnAge > FishBase (snapshot pinned, e.g. v25.04) |
| Aquatic invertebrates | AnAge > SeaLifeBase (snapshot pinned) |
| Aves | AnAge > EURING longevity list (2023-09-01) > USGS Bird Banding Lab longevity records |

Every value from every source is kept in `lifespan_observations.parquet` (long format), not only the
chosen one. EURING and USGS are wild ringing records and usually underestimate the maximum; this is
recorded in `lifespan_record_type`.

## 3. Quality

Include every qualifying species. Carry `lifespan_quality` and `lifespan_sample_size` (AnAge data quality
and sample size; source-specific equivalents mapped to a shared scale). Default correlations exclude low
quality and estimated or imputed values; the explorer can toggle the filter. Also publish AnAge-only
correlations for direct comparison with the 2016 paper.

## 4. Changed upstream data on original species

Replace outright with current values (new RefSeq version, re-annotation, revised AnAge longevity). The
old value is preserved in the changelog (section 6), not in parallel columns. Build 1 stays available as
a frozen snapshot (section 7).

## 5. Retired and renamed species

Never delete a row. Mark it with `record_status = retired` and `retired_reason` (RefSeq record suppressed
or replaced, AnAge entry removed, no longer qualifies), or `renamed` with the previous name kept in
`previous_scientific_names`. Retired rows are excluded from default correlations but remain visible,
downloadable and reachable at their old URLs.

## 6. Edit metadata

Row-level columns on every data parquet (`species`, `region_stats`, `codon_usage`, `genome_features`,
`lifespan_observations`):

| Column | Meaning |
|---|---|
| `added_in_build` | `1` or `2` |
| `added_at` | date the row first entered the database (build 1 rows: 2015 build date) |
| `last_modified_build` | build of the latest change, null if never changed |
| `last_modified_at` | date of the latest change, null if never changed |
| `record_status` | `original`, `updated`, `new`, `renamed`, `retired` |
| `source_version` | upstream version used for this row (e.g. `NC_012920.1`, `AnAge build 15`) |

`correlations.parquet` is fully derived and recomputed each build. It carries `build` plus the filters
and lifespan sources used, not row history.

`changelog.parquet`, one row per field change:
`build, changed_at, table, row_key, field, old_value, new_value, change_type, reason, upstream_source,
upstream_version, scope`. `change_type` is one of `added`, `value_update`, `renamed`, `retired`,
`correction`. `scope = rule` marks a systematic correction (for example the build-1 complemented base
labels) logged once with its rule instead of once per affected row. `pipeline/validate.ts` checks that
row metadata and the changelog agree.

## 7. Versioning and reproducibility

- Build 1: an immutable snapshot of the 2015 CSVs converted to parquet, published at `public/data/build1/`.
- Build 2: dated. `build-info` and the per-row `source_version` pin the AnAge build, every RefSeq
  `accession.version`, FishBase/SeaLifeBase snapshot versions, EURING and USGS list dates, download
  dates and the pipeline git commit.
- Each build is intended for a Zenodo DOI.

## 8. Licensing

FishBase and SeaLifeBase are CC-BY-NC. Their values are included in the main tables with per-row
`lifespan_source`, `lifespan_license` and attribution. The downloads README states that rows sourced
from FishBase or SeaLifeBase are non-commercial.

## 9. Defaults set without explicit confirmation (revisit if needed)

- Identifier for species without an AnAge HAGRID: a minted `id` in a reserved range (>= 100000), with
  `ncbi_taxid` as the cross-source join key.
- When one species has several RefSeq mitogenomes: keep the most recently updated full-length record and
  log the choice.
- Species matching across sources: NCBI taxid first, then accepted scientific name with synonym
  resolution, then manual review. Unresolved matches are reported, never guessed.
- The pipeline stays TypeScript-only (no Python in the repo).
