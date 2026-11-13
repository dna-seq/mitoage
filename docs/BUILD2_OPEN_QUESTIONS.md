# Build 2: open questions for the owner

Each item is a call made without the owner's explicit confirmation: what was applied, the alternative,
and what switching would cost. Items a–i are the defaults given with the build 2 task; items 1–12 came up
while implementing it. Numbers are from build 2 of 2026-11-13 (`docs/BUILD2_REPORT.md`).

## Defaults given with the task

**a. Suppressed RefSeq records with a live successor.** Applied to 18 species (not 19): each switched to
the species-level record of the same NCBI species in RefSeq release 237, newest full-length if several
(Gallus gallus -> NC_053523.1, Sapajus apella -> NC_064184.1); `record_status` updated, the accession
change and every changed value in the changelog (`diff_class = refseq_successor`). The 19th, *Carduelis
pinus* (now *Spinus pinus*), was retired instead: its only "successor", NC_015198.1, is the record of
*Spinus spinus*, already cited by build 1's *Carduelis spinus*; RefSeq has no mitogenome of *Spinus
pinus*. *Alternative:* switch it anyway. *Cost:* two rows with one genome under two species names.

**b. Originals without a live mitogenome, and *Andrias davidianus*.** 17 + 1 + *Carduelis pinus* = 19
retired, with `retired_reason`, kept and visible, excluded from correlations; they keep their build 1
genome rows exactly. *Andrias davidianus* keeps its build 1 lifespan (19.9 y) because `maxLongevityYears`
is a number in the contract; its `lifespan_source` is `MitoAge_build1` and it is flagged
`lifespan_from_build1_only`. *Alternative:* make `maxLongevityYears` nullable. *Cost:* a contract change
touching about 70 uses in the site.

**c. Records that now resolve to another species** (*Carassius auratus* -> *C. langsdorfii*, *Bubalus
bubalis* -> *B. kerabau*, *Carduelis pinus* -> *Spinus spinus*): row and name kept, flag
`cited_record_resolves_to_other_species`. The RefSeq genomes of *C. auratus* (NC_015142.1) and *B.
bubalis* (NC_049568.1) are not added (listed in `review_list.csv`, `refseq_species_excluded_via_build1_link`).
*Alternative:* rename the two rows to the NCBI species and add the two genomes as new species. *Cost:*
two renames that change 2016 results, two new rows.

**d. *Hemignathus munroi* vs *wilsoni*.** NCBI name kept (the row is retired anyway: NC_025603.1 is
suppressed), flag `anage_name_differs:Hemignathus wilsoni`.

**e. Class scheme.** Build 1 labels kept for every species, including new lampreys
(`Cephalaspidomorphi`) and lobe-finned fish (`Sarcopterygii`); AnAge build 15's Teleostei etc. not
adopted. *Open part:* `order` and `family` are not harmonised: build 1 species take AnAge build 15
order/family (154 `anage_taxonomy_revision` rows), new species take NCBI's. *Alternative:* NCBI
order/family for all, or AnAge's for every species that has an AnAge entry. *Cost:* NCBI for all
changes many build 1 rows and order scopes of the 2016 comparison; AnAge-where-available leaves 575 new
species on NCBI anyway.

**f. join() features** (avian and turtle ND3 frameshift): annotated segments only. Logged once as a rule
and per instance (`rule_full_span`, 337 rows in 110 species, and 309 derived total_pc rows).

**g. `record_status = updated`** for any field change, including corrections; `change_kinds` stores what
changed (correction 335 species, common_name 110, lifespan 59, name 48, taxonomy 44, annotation 41,
genome 20, ncbi_taxid 1), so the status can be narrowed later without recomputing.

**h. Exclusions and duplicates.** The 4 marine mammals with only SeaLifeBase values are excluded by the
rule (SeaLifeBase only counts for aquatic invertebrates). Unresolved name matches (95 items in
`review_list.csv`) are not used. The three possible duplicate pairs (*Gadus ogac*/*macrocephalus*,
*Panopea generosa*/*abrupta*, *Euthynnus affinis*/*alletteratus*) are included and flagged
`possible_duplicate_species` (*Gadus ogac* is retired anyway). The pairs are listed in
`POSSIBLE_DUPLICATES` (`pipeline/steps/build2.ts`) from the audit; they are not detected automatically.

**i. Phylogeny.** Open Tree + TimeTree worked for the enlarged set: 2,305 of 2,335 species in the dated
tree (2,045 of 2,229 internal nodes dated by TimeTree). The 30 species outside it have no branch length
and do not enter PIC; nothing is imputed for them.

## Found while implementing

1. **Ids of new species.** All 1,413 new species have id 10,000,000 + NCBI species taxid, including the
   838 with an AnAge entry (their AnAge build 15 HAGRID is in `anage_build15_hagrid`). The task said AnAge
   species keep their HAGRID, but AnAge renumbered HAGRIDs since 2015: 168 of the 852 HAGRIDs of new
   species equal a build 1 id of another species. *Alternative:* the HAGRID where it is free (684) and a
   minted id for the 168. *Cost:* one id space with three meanings (2015 HAGRID, 2023 HAGRID, minted), and
   ids that change if AnAge renumbers again.
2. **Ties between secondary-source values.** When two values of one source tie for the maximum, the one
   with a stated specimen origin (FishBase `species.LongevityWild`/`Captive`) is chosen over a population
   record without one (`popchar`, "observed"). The audit took the first listed (`popchar`) in all 154
   ties. Values are identical; only `lifespan_source_record_id` and `lifespan_record_type` differ.
3. **Correlation datasets.** `default`: non-retired, not estimated, quality not low or questionable (2,202
   species); `anage_only`: the same filters with AnAge lifespans (1,710). *Alternative:* an AnAge-only set
   without the quality filter, closest to the 2016 paper (which used every AnAge value). *Cost:* a third
   dataset (about 20 s more site build) or a different comparison.
4. **Genome values of build 1 species are recomputed** from the RefSeq record for every live species
   (decisions section 4), not only for changed accessions; build 1 values that the cited record does not
   reproduce are logged as corrections. *Alternative:* keep the CSV value where present and recompute only
   changed accessions. *Cost:* build 2 would keep the full-span ND3 values (contradicting default f) and
   the values NCBI re-annotated since 2015.
5. **Pinned release vs current NCBI.** NCBI re-annotated *Pongo pygmaeus* NC_001646.1 on 2026-10-08,
   after the release 237 file (2026-09-03). Build 2 uses release 237 (still equal to build 1 for its
   regions); the audit used the newer efetch copy. The next build picks the change up.
6. **Records without sequence in the release file.** 6 of the records used carry only a CONTIG line in
   release 237; their sequence comes from NCBI efetch (gbwithparts) of the same accession.version, checked
   against the release length (listed in build-info notes).
7. **Successors without rRNA/tRNA annotation.** *Crocidura russula*'s successor NC_056768.1 annotates no
   rRNA or tRNA genes; its build 1 rows for them are kept as retired rows (flag
   `rows_not_in_current_record`). 2 species have such rows.
8. **Genome features of build 1 species** count as build 1 rows (`added_in_build = 1`) although the 2015
   export had no feature table: they are derived from the record build 1 cited.
9. **explorer.json** is 2.7 MB, above the 1.5 MB page-weight target of the explorer (served at
   `/data/explorer.json`, not committed). A site-side split (as for per-gene codons) would fix it.
10. **Provisional bird lifespans.** 26 birds take USGS BBL values because EURING was not retrieved; when
    EURING is available, `sources/euring.ts` needs a parser for the real file (none is guessed) and those
    26 may change.
11. **Non-commercial values on the site.** 549 species show FishBase/SeaLifeBase values (CC BY-NC 4.0);
    the downloads README says so and every row carries its licence. The site pages do not show the
    licence per species.
12. **Committing large outputs.** No longer a question: D3 moved the site to parquet and D4 dropped the
    5 MB rule. Every committed output is under 2.4 MB; correlations.parquet (8.5 MB) and explorer.json
    are built at site build and not committed.
