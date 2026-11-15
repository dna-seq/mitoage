# MitoAge 2: Supplementary Methods

*Supplement to `mitoage2.md`, draft of 2026-11-15. It describes MitoAge build 2 (2026-11-13) as built by
`dna-seq/mitoage` and the analyses run on it in `dna-seq/mitoage-pipelines`. Hidden comments in this file give the file, and where it matters the line, that each rule is taken from; they are
for the authors and are not part of the text. Lines starting `> AUTHOR:` are questions for the authors,
also not part of the text.*

<!-- src: written from dna-seq/mitoage at 2e9c5d4 (main, 2026-11-15) and dna-seq/mitoage-pipelines at f2006a9
(main). The main text cites the build at 84ba6f7 and the correlation table as rebuilt at 1dda8be; no rule
described here changed between those commits and 2e9c5d4 except the scope rule of S10.3 (IC-8), which the
main text's numbers already follow. -->

The main text keeps its Methods short. This supplement describes the same work at length, in the order
the build and the analyses were made: what we did at each step, why, what we considered instead, what
the step assumes and what it leaves unknown. Where the project's records give no reason for a choice,
the text says so; it does not supply one after the fact. Each section can be read on its own, and the
main text refers to them as Supplementary Methods S1 to S14.

## S1. Sources, and why each version is pinned

MitoAge 2 is built from eight inputs: the RefSeq mitochondrion release, the NCBI Taxonomy, four lifespan
sources (AnAge, FishBase, SeaLifeBase and the USGS bird-banding records), the Open Tree of Life synthetic
tree with node ages from TimeTree, and the first release of MitoAge itself. Every one of them changes
over time. NCBI keeps only the current RefSeq mitochondrion release on its server: release 238
appeared on 2026-11-13, the day build 2 was assembled from release 237, so release 237 can no longer be
downloaded from NCBI. The NCBI Taxonomy dump is replaced by newer ones, and NCBI's archive keeps only the
dump of the first day of each month, so the dump of 2026-11-13 that build 2 read is in no NCBI archive. AnAge and the USGS records are served at unversioned addresses. A
build that read "the current version" of each would give different results on different days, and a
reader could not tell which.

<!-- src: mitoage-pipelines docs/BUILD2_REPRODUCTION.md, "Sources" (release 238 of 2026-11-13; taxonomy
archives keep the 1st of each month; AnAge URL unversioned) -->

We therefore fixed one version of each input and recorded it with a checksum where the source gives a file
(Supplementary Table S2).

**Supplementary Table S2.** Pinned upstream versions of MitoAge build 2.

| Input | Version read by build 2 | Checksum or identifier recorded |
|---|---|---|
| RefSeq mitochondrion | release 237, `mitochondrion.1.genomic.gbff.gz`, file of 2026-09-03 | md5 4491799651740f49c8f6a011cf9a96e5 |
| NCBI Taxonomy | `new_taxdump` of 2026-11-13 (Last-Modified 2026-11-13T00:42:20Z) | md5 91f95787dd7c7cfd7042ab7610f2b4b2 |
| AnAge | build 15 (2023-07-03), `dataset.zip` | md5 7ec4d19f6c8f57b22595a9ffd50ea66b |
| FishBase, SeaLifeBase | v26.06 Parquet tables on source.coop `cboettig/fishbase` (files of 2026-09-04) | md5 of each of the 8 tables read |
| USGS Bird Banding Laboratory | NABBP Longevity Records v2025.1 | md5 of the table as saved |
| EURING longevity list | list of 2023-09-01 requested | not retrieved (S4) |
| Open Tree of Life | synthetic tree opentree16.1 | the 2,241 answers of its API and of TimeTree's, kept |
| TimeTree | TimeTree 5, public API | as above |
| MitoAge release 1 | the full CSV export of 2015-07-01 | SHA-256 of every CSV file |

<!-- src: docs/BUILD2_REPORT.md "Pinned upstream versions"; mitoage-pipelines docs/BUILD2_REPRODUCTION.md
"Sources" (taxonomy md5, the 8 FishBase/SeaLifeBase files, the 2,241 tree answers); pipeline/sources/pinned.ts -->

The pipeline refuses to run when a pinned file is missing, and it refuses an AnAge file whose md5 differs
from the pin, since a new `dataset.zip` would be a new AnAge build. It does not fall back to a newer file.
The one exception is the EURING list, which could not be retrieved (euring.org was in maintenance on
2026-11-13); the build records it as not retrieved and uses no EURING value. The inputs that no upstream
archive keeps (RefSeq release 237, the taxonomy dump of 2026-11-13, the GenBank records read by efetch,
AnAge build 15, the USGS table, the Open Tree and TimeTree answers and the pages of the old site) are
mirrored in the Hugging Face dataset `longevity-genie/mitoage-build2-sources` (revision 9d55d726…, 18
files, with the original address, retrieval date, md5 and SHA-256 of each).

<!-- src: pipeline/sources/pinned.ts:92-101 (requirePinned throws, "no silent substitute");
pipeline/sources/anage.ts:46-50 (md5 check); docs/BUILD2_REPORT.md "Pinned upstream versions" (EURING);
mitoage-pipelines docs/BUILD2_REPRODUCTION.md "The snapshot dataset" -->

Two choices about sources were made at the start and kept. Mitogenomes come from RefSeq only, as in
release 1; no GenBank record outside RefSeq is used. The project's records give no reason beyond keeping
release 1's rule. Lifespans come only from sources that are curated and regularly maintained. Static
compilations published once (the Amniote database, AmphiBIO, COMBINE and PanTHERIA) were excluded under
that rule, because they cannot be re-derived from a newer version when their values are corrected.

<!-- src: plans/DATA_BUILD2_DECISIONS.md §1 ("Static one-off compilations ... are excluded under the
'regularly maintained' rule"; "Mitogenomes: RefSeq only") -->

**Assumptions and what is not known.** Pinning makes the build repeatable; it does not make a source correct, and it fixes the errors of the pinned version along with its values.
Newer releases of the sources are looked for weekly, and a newer release becomes its own piece of work. Whether the USGS records and AnAge change at their unversioned addresses is checked
by md5 each time the reproduction downloads them (both matched on 2026-11-14), not prevented.

<!-- src: docs/ROADMAP.md RM6 (weekly check for a release newer than each pin); mitoage-pipelines
docs/BUILD2_REPRODUCTION.md "Known gaps" (AnAge and the USGS page are unversioned) -->

## S2. Which mitogenomes enter: complete records, one per species

The inclusion rule of release 1 is kept: an animal species enters if it has a complete mitochondrial
genome in RefSeq and a maximum lifespan from a curated source. For build 2 we had to make "complete"
explicit, because RefSeq's records do not carry a completeness field. The rule reads the record's
definition line. A record counts as complete when its accession begins with `NC_`, its definition does
not say "partial" or "nearly complete", does not name one of several molecules (chromosome, minicircle,
segment, part, fragment, minichromosome, molecule), and does say "complete genome", "complete
mitochondrial genome" or "complete sequence", or describes a genome assembly of the mitochondrion with
circular topology. A linear assembly, a non-`NC_` record and a definition that fits none of these are
excluded, and the class of each exclusion is kept. Only records whose lineage includes Metazoa are read.

<!-- src: pipeline/sources/refseq-release.ts:80-105 (completeness, MULTI regex); pipeline/steps/refseq.ts:19-24 -->

The species of a record is found through the taxonomy: the record's taxon identifier is brought up to
date through the taxonomy's list of merged identifiers, and then raised to its nearest ancestor of
species rank, so that a record of a subspecies counts for its species. When a species has several
complete records, the one whose LOCUS date is latest is kept; between records of the same date, one at
least 75% as long as the median complete record of its NCBI class is preferred to a shorter one; then the
higher accession.version, compared as text. The choice and the records not chosen are logged. In release
237 this rule finds 16,008 complete metazoan mitogenomes from 15,876 species.

<!-- src: pipeline/steps/refseq.ts:21-60 (classifyRelease, 0.75 * class median, compareRecords);
data/cache/build2/candidates/build2_candidates_summary.md via docs/manuscript/NOTES.md (16,008 / 15,876) -->

The order of these preferences was set as a default at the start of build 2 ("keep the most recently
updated full-length record") and was not separately confirmed; the records give no further reason. As
implemented, the date comes first, so a newer record that is short for its class would be kept over an
older full-length one. The length test only breaks ties of date.

<!-- src: plans/DATA_BUILD2_DECISIONS.md §9 (defaults set without explicit confirmation); pipeline/steps/refseq.ts:54-60 -->

> AUTHOR: the default said "most recently updated full-length record"; the code orders by date first and
> uses length only between records of the same date. How many species, if any, keep a record that is
> short for its class has not been counted. Confirm the intended order.

Six of the records chosen carry only a CONTIG line in the release file, with no sequence. Their sequence
and features were taken from the same accession.version through NCBI efetch and checked to have the
length the release states. The 2015 export holds 923 species, one more than the published release: the
extra one, *Loxioides bailleui* (NC_025626.1), is titled a complete genome but is 9,243 bp long, about 7
kb short of a complete bird mitogenome, and is excluded from every build.

<!-- src: public/data/README.md "Data notes" (6 CONTIG-only accessions; Loxioides bailleui) -->

**Assumptions and what is not known.** The rule trusts the definition line: a record titled complete
that is not complete would enter, as *L. bailleui* shows, and only that one case has been examined by
hand. Nothing in the rule checks that the 13 protein genes, 2 rRNAs and 22 tRNAs are all annotated; the
alignments and features record which genes a record lacks (S8).

## S3. Matching lifespan records to species without guessing

Each lifespan source names its species in its own way, and those names must be matched to the NCBI
species of the mitogenomes. A wrong match puts one species' lifespan on another's genome, which no later
check would detect, so the matcher was written to refuse rather than guess.

Names are compared after removing parenthesised parts and quotation marks, collapsing spaces and
lower-casing. A source record is then tried against four lists in a fixed order, and the first that gives
an answer is used: the NCBI scientific names; the NCBI synonyms (names marked synonym, equivalent name or
GenBank synonym); for FishBase and SeaLifeBase, the source's own synonym table, using names it marks as
synonym, accepted name or provisionally accepted name and never a misapplied name; and last, for a name of
three words, its first two. A name that leads to more than one NCBI species is ambiguous and is not used.
When several records of one source lead to the same species, the record matched by the strictly best
method of the four is used and the others are set aside; if two records tie on method, none is used.

<!-- src: pipeline/steps/lifespan.ts:1-10, 67-73 (METHOD_RANK), 90-157 (matchSourceNames); name normalisation
in pipeline/sources/ncbi-taxonomy.ts (nameKey), as stated in mitoage-pipelines docs/BUILD2_REPRODUCTION.md
"Lifespan sources and matching" -->

Records that could not be matched go to a review list and stay out of the build until someone resolves
them. The list is limited to records that could have mattered: an unmatched name is listed only if the
release has complete mitogenomes in its genus, and an ambiguous or set-aside record only if one of its
candidate species has a complete mitogenome. Build 2's review list has 95 items: 79 source names that
matched no species, 10 records set aside because a better-matched record of the same source named the
same species, 3 pairs of possible duplicate species, 2 RefSeq species excluded because a release-1 row
already links to them, and 1 release-1 row whose taxon identifier another release-1 row shares.

<!-- src: pipeline/steps/build2.ts:645-662 (review rules); public/data/review_list.csv (counts by review_type) -->

The species of release 1 were linked to AnAge build 15 through their release-1 AnAge entry: the AnAge
entry with the same scientific name, or else the only entry with the same common name. New species are
every NCBI species with a complete mitogenome in release 237 and a chosen lifespan (S4) that is not
already linked to a release-1 row through its record, its species or its AnAge entry.

<!-- src: mitoage-pipelines docs/BUILD2_REPRODUCTION.md "Build 1 as the starting point" and "New species"
(pipeline/steps/build2.ts) -->

Three further decisions concern identity. First, new species have the identifier 10,000,000 plus their NCBI
species taxon identifier. The plan was to give species with an AnAge entry their AnAge identifier
(HAGRID), but AnAge has renumbered its entries since 2015: 168 of the 852 HAGRIDs of new species equal a
release-1 identifier of another species. Second, classes follow the labels of release 1 for every species
(Actinopterygii, Reptilia, Cephalaspidomorphi for lampreys, Sarcopterygii for lungfishes and
coelacanths), assigned to new species from the RefSeq lineage, so that scopes stay comparable with the
2016 paper; AnAge build 15's newer fish classes were not adopted. Order and family were not harmonised:
release-1 species take AnAge build 15's, new species NCBI's (main text, Table 1 note). Third, the three
possible duplicate pairs (*Gadus ogac* and *G. macrocephalus*, *Panopea generosa* and *P. abrupta*,
*Euthynnus affinis* and *E. alletteratus*) are kept and flagged. They come from a fixed list made by the
audit of S11; the pipeline does not look for duplicates itself.

<!-- src: docs/BUILD2_OPEN_QUESTIONS.md item 1 (ids, 168 of 852), item e (class scheme, order/family), item h
(duplicates); pipeline/steps/lifespan.ts:36-53 (harmonisedClass) -->

**Assumptions and what is not known.** The matcher assumes that a name which leads to exactly one NCBI
species names that species. A source that uses a valid name for a different concept than NCBI's would be
matched wrongly, and nothing here would notice. Three release-1 records now resolve in NCBI to another
species (*Carassius auratus* to *C. langsdorfii*, *Bubalus bubalis* to *B. kerabau*, and *Carduelis
pinus*, whose only candidate is the record of *Spinus spinus*). Their rows and names are kept and flagged.
Whether to rename them is one of the open questions put to the maintainer.

<!-- src: docs/BUILD2_OPEN_QUESTIONS.md item c; docs/ROADMAP.md RM4 -->

## S4. Lifespan values: precedence, record types and the shared quality scale

**Which source is used.** AnAge, the only lifespan source of release 1, is always first: a species with
an AnAge maximum longevity takes it, whatever any other source says. Only where AnAge has no value does a
second source fill it, and which one depends on the animal's group, read from its RefSeq lineage:

| Group (from the lineage) | Sources in order |
|---|---|
| Birds (lineage includes Aves) | AnAge, then EURING, then USGS Bird Banding Laboratory |
| Fishes (Actinopterygii, Chondrichthyes, Cyclostomata, Dipnomorpha or Actinistia) | AnAge, then FishBase |
| Invertebrates (lineage does not include Vertebrata) | AnAge, then SeaLifeBase, only for species SeaLifeBase marks as living in fresh, brackish or salt water |
| Other vertebrates (mammals, reptiles, amphibians) | AnAge only |

<!-- src: pipeline/steps/lifespan.ts:15-34 (PRECEDENCE, taxonGroup), 174-199 (chooseLifespan, SeaLifeBase
aquatic filter); plans/DATA_BUILD2_DECISIONS.md §2 -->

The group is read from the lineage, so a lancelet or an ascidian counts as an
invertebrate here, and four marine mammals whose only values are in SeaLifeBase get none, since
SeaLifeBase is used only for invertebrates. The records give no reason for the order of the secondary
sources beyond the table itself, which was agreed with the maintainer at the start of build 2. Because
EURING could not be retrieved, its place is empty and the 26 birds whose lifespan comes from USGS are
flagged as provisional: if EURING has a value for them, it would replace USGS's.

<!-- src: docs/BUILD2_OPEN_QUESTIONS.md item h (4 marine mammals) and item 10 (26 provisional birds) -->

**Which value within a source.** A secondary source often holds several values for one species. They are
sorted into three tiers: reported values not marked questionable; then reported values marked
questionable; then estimates. The largest value of the first tier that has any is chosen, since the trait
is the maximum recorded lifespan. When two values tie for the maximum, a value with a stated specimen
origin (wild or captive) is preferred to one without (observed), and then the first listed. This
tie-break affects 154 species, where the values are equal and only the record named as the source
differs; it was set during implementation and the records give no reason for it.

<!-- src: pipeline/steps/lifespan.ts:166-199; docs/BUILD2_OPEN_QUESTIONS.md item 2 (154 ties) -->

**Record types and the shared quality scale.** Each value carries a record type (captive, wild,
observed or estimated) and a quality on one scale shared by all sources (high, acceptable, questionable,
low). The scale is AnAge's own data-quality grade; for the other sources we mapped what each source
records onto it. The mapping is the following, field by field:

| Source | Field read | Record type | Quality |
|---|---|---|---|
| AnAge build 15 | Maximum longevity (yrs) | wild if the specimen origin is "wild", captive if "captivity", otherwise observed | AnAge's data quality as given (high, acceptable, questionable or low) |
| FishBase, SeaLifeBase | `popchar.tmax` (reported maximum age of a population) | observed | questionable when `tmaxQuality` is −1, otherwise acceptable |
| FishBase, SeaLifeBase | `species.LongevityWild` | wild | acceptable |
| FishBase, SeaLifeBase | `species.LongevityCaptive` | captive | acceptable |
| FishBase, SeaLifeBase | `popgrowth.tmax` (maximum age from a growth study) | estimated | low |
| USGS Bird Banding Laboratory | Minimum age at encounter, as years plus months/12 | wild | acceptable |

<!-- src: pipeline/sources/anage.ts:92-113; pipeline/sources/observation.ts:62-65 (asQuality);
pipeline/sources/fishbase.ts:5-7, 52-108; pipeline/sources/usgs-bbl.ts:9-33 -->

Two points of this mapping need saying. AnAge's record type follows the origin of the specimen, not how
its age was determined, so an AnAge age of a wild animal is "wild" whatever the method of ageing; only
FishBase and SeaLifeBase growth-study values are "estimated". And a ringing record is the oldest
recaptured wild individual of a species. It is a real observation, so it is acceptable on this scale, but
it usually underestimates the maximum. The mapping itself is a judgement: it puts values of different
sources on one scale, and that scale has not been calibrated against anything.

Every value of every matched source is kept, not only the chosen one, in a long table of 7,197 rows
(`lifespan_observations.parquet`), with the source's record identifier, how its name was matched and
whether it was chosen. The release-1 value of each original species is kept there too. It is chosen for
one species only, *Andrias davidianus*, for which AnAge build 15 has no maximum longevity: the species is
retired (S6) and keeps its 2015 value, flagged, because the data contract has no empty lifespan.

<!-- src: docs/BUILD2_REPORT.md Summary (7,197 rows); docs/BUILD2_OPEN_QUESTIONS.md item b -->

Among the 2,316 live species the chosen values distribute as follows:

| Source | Acceptable | High | Low | Questionable | Captive | Wild | Observed | Estimated |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| AnAge | 1,615 | 95 | 0 | 31 | 854 | 833 | 54 | 0 |
| FishBase | 405 | 0 | 36 | 34 | 33 | 200 | 206 | 36 |
| SeaLifeBase | 61 | 0 | 13 | 0 | 0 | 43 | 18 | 13 |
| USGS BBL | 26 | 0 | 0 | 0 | 0 | 26 | 0 | 0 |
| **Total** | **2,107** | **95** | **49** | **65** | **887** | **1,102** | **278** | **49** |

<!-- src: docs/BUILD2_REPORT.md "Lifespan source x quality and x record type (non-retired species)" -->

The 49 values of low quality are exactly the 49 estimates, and the correlation datasets leave both out,
together with the 65 questionable values (S10.1).

**Assumptions and what is not known.** One value per species is used, the maximum. AnAge's sample size is kept where AnAge gives it, but is not used in any test. The 26 bird values
from USGS are provisional until EURING is read.

## S5. The strand convention, and how it was found

Release 1 gave the base composition of every region of every species, and the first run of the new
pipeline (2026-11-12) tried to reproduce those counts from the records release 1 cited. They did not
match. For the human
reference (NC_012920.1) release 1 lists A = 4,094, C = 2,169, G = 5,181 and T = 5,124. The deposited
sequence has A = 5,124, C = 5,181, G = 2,169 and T = 4,094: each release-1 column holds the count of the
complementary base. The same swap holds for the whole genome of all 922 species. Across region
statistics, none of 18,030 species-region pairs matched with release 1's labels and 17,677 (98.0%)
matched once the labels were swapped (A for T, C for G); the remainder differ for the reasons S6
classifies, annotation changes since 2015 among them. Codon counts, which are read in gene sense, were labelled correctly: recounting reproduced 11,894
of 11,941 gene rows (99.6%).

<!-- src: plans/handoffs/HANDOFF_mitoage-next-site_2026-11-12.md:69-71 (build-info notes of the first
pipeline run: rCRS counts, 922/922 in total_mtDNA, 17,677/18,030 = 98.0% with swapped labels, 0 with the
original labels, codons 11,894/11,941); pipeline/steps/build1.ts:88-90 -->

The swap is uniform: it holds for every region, including the genes encoded on the other strand. So
release 1 reported, for every region, the counts of the strand complementary to the one deposited in
RefSeq. In most vertebrate records the deposited strand is the light strand, so release 1's counts are
those of the heavy strand, as the 2016 paper says was analysed. The repository's documents call this a
"base-label bug"; the main text treats it as a convention that is now made explicit. Which reading is
right depends on what the 2015 pipeline meant to count, which only its authors can say.

> AUTHOR: please confirm whether the 2015 pipeline meant to report the heavy strand (a convention, as the
> main text says) or the deposited strand (an error). NOTES.md, Q1.

We chose to report every count on the strand as deposited, and not to convert all records to the heavy
strand. The reason is that the heavy strand cannot be identified from every record. RefSeq does not fix
which strand is deposited. We call a record's orientation canonical when it is a chordate record with all
13 protein genes, every copy of ND6 on the minus strand and every other protein gene on the plus strand;
the plus strand is then the light strand. Of the 2,335 species, 2,196 have canonical records, 16 are
chordates with another layout, 104 are not chordates, for which this heavy and light notation is not
defined, and 19 have no record. A heavy-strand convention would have needed a guess for 120 of them.

<!-- src: pipeline/steps/extended.ts:90-106 (orientationOf); public/data/README.md "Data notes" (canonical 2196,
noncanonical 16, not_chordate 104, unknown 19) -->

What changes for a reader of release 1: GC content does not change; GC and AT skews change sign, and so do
their correlations with any trait. Codon and amino-acid usage do not change, because they were and are
counted in gene sense. The new features that need the heavy strand (base composition at fourfold sites in
heavy-strand notation, S7.3) are given only for canonical records and are left empty for the others.

**Assumptions and what is not known.** The canonical test is a test of annotation: a record deposited
the other way round would show ND6 on the plus strand and would be classed noncanonical. Outside the chordates, which strand each record deposits is not known, so the strand
skews of the 104 non-chordates are on deposited strands that need not correspond to one another.

## S6. Re-verification of release 1 and the changelog

**Release 1 as the starting point.** The 2015 CSV export was converted to Parquet without changing a
value: the same rows in the same order, the same column names, and a column stored as a number only when
every cell converts back to exactly the same text. The SHA-256 of each source CSV is published with it.
This frozen copy is the reference every change is measured against.

<!-- src: pipeline/steps/build1.ts:78-90; docs/BUILD2_REPORT.md Summary (34 parquet files) -->

**Which record each original species now has.** For each of the 922 species we looked up the record
release 1 cited in release 237. The same accession.version was live for 884 species. Two had a newer
version of the same accession, and the newer version was used. For 36, the accession was no longer in
the release. For these the pipeline looked for a complete record of the same NCBI species, preferring one
annotated at species rank to one of a subspecies, and never taking a record that another release-1
species cites. Eighteen species had such a successor and switched to it. Seventeen had none and were
retired. *Carduelis pinus* (now *Spinus pinus*) was also retired: its only candidate was the record of
*Spinus spinus*, which release 1 already cites for *Carduelis spinus*, and switching would have put one
genome under two species. *Andrias davidianus* was retired because AnAge build 15 gives it no maximum
longevity. That makes 19 retired species.

<!-- src: pipeline/steps/refseq.ts:81-91 (successorFor); docs/BUILD2_REPORT.md Summary and "Retired species";
docs/BUILD2_OPEN_QUESTIONS.md items a, b -->

Switching to a successor rather than retiring was a default given with the build-2 task. A retired
species is never deleted: its row stays visible and downloadable with the reason it was retired, its
release-1 values are kept (re-expressed on the deposited strand like every other row), and it is left out
of every analysis.

**Recomputing every value.** Every value of every live original species was recomputed from its current
record, not only those whose record had changed. The alternative was to keep the 2015 value wherever the
cited record was unchanged. We did not take it because it would have kept values that the current record
no longer gives: the full-span counts of genes annotated in pieces, and annotations NCBI has revised since
2015.

<!-- src: docs/BUILD2_OPEN_QUESTIONS.md item 4 -->

**Explaining each difference.** Every value that differs from release 1 becomes one row of the
changelog, with the table, row and field, the old and new values, the kind of change (added, value
update, correction, renamed or retired), its cause and the upstream version. The cause is found by trying
explanations in a fixed order and recording the first that reproduces the release-1 value. For a single
region the order is:

1. the release-1 value equals the count over the full span of a gene annotated in pieces (`rule_full_span`);
2. it equals the count on the INSDC record that the RefSeq record names as its source, so the RefSeq
   record was re-annotated without a change of version (`upstream_reannotation_same_version`);
3. it equals the count over the span of the gene feature rather than the coding feature (the same, marked
   probable);
4. it equals the count over a window within 60 bp of the current coordinates
   (`coordinates_differ_origin_unresolved`);
5. otherwise, release 1 disagrees with the record it cited (`build1_disagrees_with_cited_record`).

Aggregates (all protein-coding genes, all rRNAs, all tRNAs) and the codon usage of all protein-coding
genes inherit the cause of the genes they are made from. When a species changed record, every difference
is attributed to the change of record (`refseq_successor` or `upstream_version_change`).

<!-- src: pipeline/steps/diff.ts; order of the classes as stated in mitoage-pipelines
docs/BUILD2_REPRODUCTION.md "Changelog and provenance" -->

For the second test the INSDC source records were needed. The build-2 pipeline used the 160 INSDC records
its audit (S11) had downloaded, a set chosen by hand. The independent reproduction chose them by a written
rule (the 151 release-1 species that keep their accession.version and whose values differ) and obtained
the same changelog class for every row.

<!-- src: mitoage-pipelines docs/BUILD2_REPRODUCTION.md "INSDC records" and "Known gaps" -->

Systematic corrections are logged once, as rules, instead of once per affected row: the complementary
base labels (S5), the counting of genes annotated in pieces over their annotated pieces only (the ND3 of
birds and turtles carries an untranslated frameshift nucleotide that the 2015 counts included), the
regions release 1 lacked although the records it cited annotate them, and the exclusion of the 923rd
species. The changelog has 14,392 rows (main text).

**Renames and status.** Names follow NCBI only. The NCBI name of a species replaces its release-1 name
when the change is a genus transfer, a change of spelling or gender of the epithet, or both, and the old
name is kept. A rename in AnAge alone is recorded only as a flag. Each species then has one
status, ranked retired, renamed, updated, original: updated if any changelog row names it, original if
none does. Rows of the region, codon and feature tables take their status from their own changelog rows.
The pipeline's validation step stops the build if a species' status and the changelog disagree.

<!-- src: mitoage-pipelines docs/BUILD2_REPRODUCTION.md "Status of the 922" and "Changelog and provenance";
docs/BUILD2_CROSSCHECK.md "Every disagreement" item 1; pipeline/validate.ts -->

"Updated" covers any change of any field, a corrected common name included. The kinds of change are
stored with each species (correction, common name, lifespan, name, taxonomy, annotation, genome, NCBI
identifier), so the status can be narrowed later without recomputing.

<!-- src: docs/BUILD2_OPEN_QUESTIONS.md item g -->

**Assumptions and what is not known.** The cause recorded for a difference is the first explanation in
the list that reproduces the old value. It is consistent with the data; it is not proof of what happened
in 2015. The record NCBI re-annotated after release 237 (*Pongo pygmaeus*, NC_001646.1, re-annotated in
place on 2026-10-08) is read as release 237 has it; the next build will pick up the change.

## S7. Mitochondrial features

### S7.1 Regions, base composition and skews

Values are computed for 20 regions: the whole genome, each of the 13 protein-coding genes, the two
rRNAs, the D-loop, and the aggregates of all protein-coding genes, all rRNA genes and all tRNA genes. An
aggregate is the union of the positions of its features, so a base shared by two overlapping genes is
counted once. A single gene is its first copy in genome order when a record annotates it twice. The
D-loop is the record's D-loop features; a feature annotated as a control region (a misc_feature; pseudo, partial and repeat features excluded) is used only when the record has no D-loop feature. Counts are on the
deposited strand (S5). GC content is 100 (G+C)/(A+C+G+T) over unambiguous bases; the GC skew is
(G−C)/(G+C) and the AT skew (A−T)/(A+T), undefined when the denominator is zero. The non-coding length is
the number of positions covered by no protein-coding, rRNA or tRNA gene, so the D-loop counts as non-coding.

<!-- src: pipeline/steps/regions.ts:30-70; pipeline/lib/stats.ts:11-30; D-loop rule as stated in
mitoage-pipelines docs/BUILD2_REPRODUCTION.md "Genome values" -->

Feature names differ between records (COI, CO1 and COX1, for example) and are made consistent from the
gene, product, standard name, note or locus tag. The two leucine and two serine tRNAs are told apart by
codon family, from the anticodon, the codons recognised, the name or the numbering; in chordates also by
gene order (tRNA-Leu(UUR) follows the 16S rRNA, tRNA-Ser(UCN) follows COX1). A gene annotated in pieces
(`join()`) is counted over its annotated pieces only.

<!-- src: pipeline/lib/names.ts; mitoage-pipelines docs/BUILD2_REPRODUCTION.md "Genome values" -->

### S7.2 Codon and amino-acid usage

Each protein-coding sequence is read in its own sense from the position its `codon_start` gives, and
only complete codons of unambiguous bases are counted. The usage of all protein-coding genes is the sum
of the gene rows. Each codon is given as a percentage of all codons counted, stop codons included; each
amino acid as a percentage of the sense codons. Amino acids are translated with the genetic code of the
record: the `transl_table` that most of its coding features state, or, when none states one, code 2 for
chordates, 9 for echinoderms and 5 otherwise. Feature values enter the correlations rounded (GC content
and codon percentages to three decimals, skews to four).

<!-- src: pipeline/lib/genetic-code.ts:50-61 (countCodons); pipeline/steps/features.ts:52-84;
pipeline/steps/genome.ts:115-142 (transl_table vote and fallback); fallback codes as stated in
mitoage-pipelines docs/BUILD2_REPRODUCTION.md "Genome values" -->

These two families, with length and non-coding length, are the 1,257 features release 1 also had in
some form: four per region (length, GC content and the two skews) for 20 regions, the non-coding length,
and 64 codons and 20 amino acids for each of the 13 genes and their total.

<!-- src: pipeline/steps/features.ts:24-49 (20 x 4 + 1 + 14 x 64 + 14 x 20 = 1,257) -->

### S7.3 The extended features

Build 2 adds 157 features, chosen to test relationships the literature reports and release 1 could not
test. They answer the same questions about lifespan as the others, so they were made ordinary members of
the feature catalogue rather than a separate set with its own tables. One consequence, accepted when the
decision was made, is that they share the false discovery rate with every other feature (S10.4).

<!-- src: pipeline/steps/extended.ts:323-367 (buildExtendedDefs: 56 + 56 + 14 + 6 + 20 + 3 + 2 = 157);
docs/DECISIONS.md D7 -->

**Fourfold-degenerate sites.** A codon family is fourfold degenerate when all four bases at its third
position code the same amino acid and none is a stop, in the record's own genetic code; the pipeline
derives the list of such families from the code rather than taking a fixed list. The features are the
shares of A, C, G and U at the third positions of those codons, in gene sense, for each gene and for all
13 together (56 features). A substitution at these positions does not change the protein, so their
composition is used as a measure of mutational pressure. For canonical records (S5) the same counts are
also given in heavy-strand notation (56 features): for a gene on the plus strand the heavy-strand base
is the complement of the gene-sense base, and for ND6, which is read from the heavy strand, it is the
gene-sense base itself. The heavy-strand total is taken over the 12 genes on the plus strand, without
ND6. Non-canonical records have no heavy-strand values.

<!-- src: pipeline/steps/extended.ts:29-76 (fourfoldPrefixes, fourfoldCounts, toHeavyStrand), 204-221, 286-305
(major12) -->

**Hydropathy.** The grand average of hydropathy (GRAVY) of each encoded protein and of all 13 together:
the mean Kyte–Doolittle value over the amino-acid counts of S7.2, stop codons excluded (14 features).

<!-- src: pipeline/steps/extended.ts:21-25, 78-88 -->

**Repeats.** Perfect direct repeats (two copies on the same strand), inverted repeats (the second copy is
the reverse complement of the first) and mirror repeats (the second copy is the first read backwards
without complementing) of at least 10 bases. A pair is counted once, is maximal (it cannot be extended
on either side) and its two copies do not overlap; a base other than A, C, G or T breaks a repeat. The
sequence is read as linear, so a repeat that spans the origin of the circular genome is not found.
Mirror repeats are counted separately because they are a class of non-B DNA of their own, not a subset of
the inverted repeats. The features are the number of pairs of each kind and the length of the longest
direct repeat, over the whole record and over the major arc.

<!-- src: pipeline/lib/repeats.ts:1-143; pipeline/steps/extended.ts:18-19 (REPEAT_MIN_LENGTH = 10) -->

**The major arc.** Repeats and motifs are also counted over the major arc, the part of the genome
between the two replication origins. The arc is delimited by annotation: from the base after
tRNA-Asn (the light-strand origin lies between tRNA-Asn and tRNA-Cys) forward along the circle to the
base before the first control region downstream of CYTB, the control region excluded. It is defined
only for canonical records with single copies of tRNA-Asn, COX1 and CYTB that do not span the origin and
that come in the circular order tRNA-Asn, COX1, CYTB, control region; otherwise it is left empty. It is
defined for 1,906 of the 2,335 species. Its length is a feature of its own.

<!-- src: pipeline/steps/extended.ts:115-154 (majorArc); public/data/README.md "Data notes" (1,906 of 2,335) -->

**Deletion contact zones.** Most human mitochondrial deletions are flanked by repeats with one arm in
each of two regions, given in human work as roughly 6 to 9 kb and 13 to 16 kb. Kilobase coordinates do
not transfer between species, so the zones are anchored on genes: the span from the start of ATP8 to the
end of COX3, and the span from the start of ND5 to the end of CYTB. They are defined only when all four
genes are annotated once, none spans the origin and they come in that order along the record (2,217
species). The features are the number of direct, inverted and mirror repeat pairs with one arm starting
in each zone.

<!-- src: pipeline/steps/extended.ts:156-198 (contactZones, bridgingPairs); public/data/README.md "Data notes"
(2,217); the zones follow Persson et al. 2023, BMC Biol, as cited in the code comment and in
docs/ANALYSIS_FINDINGS.md H8 -->

**Sequence motifs.** Counted over the whole record and over the major arc, each on the sequence read as
linear:

- G-quadruplex motifs: four runs of at least three G separated by loops of 1 to 7 bases, counted on each
  strand (the same pattern of C-runs on the deposited strand) and summed;
- homopurine and homopyrimidine tracts of at least 15 bases, candidates for triplex formation;
- homopolymer runs of at least 5 bases, and the longest run;
- perfect di-, tri- and tetranucleotide tandem repeats of at least three whole units, and the bases they
  cover. A unit that is itself a repeat of a shorter unit (AAAAAA read as the dinucleotide AA) is left to
  the shorter unit length, so the three counts do not count the same bases twice.

<!-- src: pipeline/lib/motifs.ts:1-99 (HOMOPOLYMER_MIN 5, TRACT_MIN 15, STR_MIN_UNITS 3, G4 regexes,
tandemRepeats period rejection) -->

The rejection of shorter periods was added after an exploratory run that did not have it had produced a
result for G-quadruplexes that did not reproduce (S12.3). These are counts of sequence patterns, not
predictions that a structure forms. The project's records give no reason for the thresholds (10 bases
for repeats, 15 for tracts, 5 for homopolymers, three units, loops of 1 to 7).

> AUTHOR: the thresholds of the repeat and motif features have no recorded reason. If they follow a
> published convention (for example Toren et al. 2021, which proposed motif counts as longevity features),
> cite it here.

**Control regions.** The number of annotated control regions (D-loop features, or control-region
features where there is no D-loop). A count of 1 is a lower bound: assemblies from short reads can miss a
duplicated control region.

**Assumptions and what is not known.** Every repeat, motif and control-region count is read from the
deposited sequence as assembled, and depends on how it was assembled (main text, "Repeats, motifs and the
rate of evolution"). Of the records matched in release 237, one states a sequencing technology, so the
dependence cannot be measured on this build.

## S8. Alignments and the choice of aligner

Comparing species site by site needs alignments. A check made before any pipeline work found no live
resource offering alignments of the mitochondrial genes across these species, and one published
site-level screen of lifespan (Mariadassou and Pellay, 2014). We aligned each gene separately. A
whole-genome alignment was not used, because gene order differs between phyla and its columns would mean
little.

<!-- src: docs/DECISIONS.md D5 -->

**What is aligned.** Each of the 13 proteins, as RefSeq translates it (the record's own translation),
first copy per record, across the 2,316 live species, sorted by the species' identifier (slug). The
codon alignment each protein alignment implies is written beside it: each residue replaced by its codon
and each gap by three gaps, without the stop codon; codon rows that do not translate exactly to their
protein are listed. The two rRNA genes are aligned as nucleotides the same way.

<!-- src: public/data/alignments/README.md; pipeline/align.ts; pipeline/lib/align.ts (threadCodons) -->

**The aligner.** MAFFT v7.526 with its FFT-NS-2 method (`--retree 2 --maxiterate 0`), four threads.
MAFFT was proposed with the design of this step and accepted with the design as a whole. An aligner
written in TypeScript was rejected as far slower and worse on 2,300 sequences. The method is named in full rather than left to MAFFT's automatic choice, and the version is
pinned: the pipeline stops if it finds another MAFFT version, so the alignments cannot change silently
with an upgrade. The records give no reason for FFT-NS-2 over MAFFT's slower iterative methods beyond its
description in the code as MAFFT's progressive method for thousands of sequences. The result is checked
to hold exactly the input sequences, in their order.

<!-- src: pipeline/steps/alignments.ts:17-58 (MAFFT_VERSION, MAFFT_ARGS, requireMafft, align); pipeline/align.ts:24
(4 threads); docs/DECISIONS.md D5 -->

A summary file gives for each alignment its numbers of sequences and columns, the columns where at most
half the rows are gaps ("occupied"), the occupied columns where every non-gap row has one residue
("invariant") and those where one residue is in at least 90% of the non-gap rows, and the SHA-256 of the
file.

<!-- src: pipeline/lib/align.ts:83-114 (summariseColumns) -->

**How much the aligner matters (H0).** Every site-level analysis reads alignment columns, so we compared the
shipped alignments with three other aligners on the same sequences: MAFFT in an iterative mode, FAMSA 2
and Muscle 5. The measure is a sum-of-pairs agreement: of the residue pairs the shipped alignment puts
in one column, the share that the other alignment also puts in one column. Agreement was at least 0.985
with every tool for COX1, COX2, COX3, CYTB and ND1, and lower for ND6 (0.87 to 0.97), ATP8 (0.92 to 0.99)
and ND5 (0.96 to 0.99). From this we set a rule for the analyses: a site-level finding in one of these
three genes is kept only if it holds on a second alignment (S12.2 applies it). Agreement between tools is
not correctness, since there is no reference alignment.

<!-- src: docs/ANALYSIS_FINDINGS.md H0; mitoage-pipelines src/mitoage_pipelines/longevity/compare.py (metric) -->

> AUTHOR: the commands and versions that produced the FAMSA, Muscle and iterative-MAFFT alignments are not
> recorded (mitoage-pipelines README: "the commands that produced them with each aligner are not
> wrapped"), and the comparison was rerun for only 2 of the 13 genes. Please supply the versions and
> options, or rerun them as commands.

**Whether aligning by structure moves the columns (H10).** The 13 proteins are membrane proteins of a
few fold families, and a sequence aligner could misplace columns that their structures would put
elsewhere. Another agent (Claude Science) ran this check on the cluster host `haumea` on 2026-11-14 and
15. Its scripts were then made commands of `mitoage-pipelines` (commit f2006a9) and rerun on the same
cluster. The check has two parts. First, the 13 proteins from solved human structures (PDB 5XTD, 5Z62,
5XTE and 8H9S; identity to MitoAge's human sequences 0.979 to 1.000) were superimposed all against all
with US-align. Only three pairs exceed a TM-score of 0.5 normalised by the longer chain, all among the antiporter-like subunits ND2, ND4 and ND5 of complex I; the others are unrelated folds. Second, structures of the
13 proteins were predicted for 62 mammals (806 structures, ESMFold2 checkpoint `biohub/ESMFold2-Fast`,
one sample each; published as the Hugging Face dataset `longevity-genie/mitoage-structures`, revision
8e5cfdc), aligned with FoldMason, and compared with MAFFT L-INS-i on the same sequences by the
same sum-of-pairs agreement, over at most 500 species pairs per gene. Median agreement was 0.9997 over the
13 genes and 1.000 in the conserved core; the lowest were ND6 (0.970) and ND5 (0.982). The rerun gave the
same tables for the superposition and the comparison, timings aside; the folding itself was not rerun, and
the published structures let a reader repeat the comparison without folding.

<!-- src: docs/ANALYSIS_FINDINGS.md H10; mitoage-pipelines README "How far it reproduces";
mitoage-pipelines src/mitoage_pipelines/structure/msa.py (L-INS-i, 500 pairs, core definition);
side-session note cluster-analyses-integrated.md (rerun on haumea, job 6486038) -->

Two limits apply. The comparison is between FoldMason and MAFFT's L-INS-i on 62 mammals, not between
structure and the shipped FFT-NS-2 alignment of 2,316 species; H0 links the two only for MAFFT's
iterative mode. And mammals are close relatives, so distant phyla, where sequence aligners are more
likely to err, are not assessed. Folding every species with all 13 proteins (2,290 species) would take
about 120 GPU-hours on the card used.

**Reproducibility.** The independent reproduction (S11) rebuilt all 28 alignment files with the same
SHA-256 as the published ones. The alignments are made by one fast method across very distant animals,
and columns in poorly conserved stretches are not reliable statements of homology.

## S9. The dated tree

Phylogenetically independent contrasts need a tree with branch lengths, which release 1 did not have.
One rule was fixed before any result: the tree must not be built from the mitochondrial genes being
tested. One of our own
analyses broke this rule once, by mistake, and a column it reported as associated with lifespan
disappeared when the analysis was rerun on the dated tree (S12.2). The tree is therefore assembled from
two external sources: its topology from the Open Tree of Life synthetic tree and its node ages from
TimeTree. The records give no reason for these two sources over others.

<!-- src: docs/ANALYSIS_FINDINGS.md H2 ("Fixed before any result"); mitoage-pipelines
src/mitoage_pipelines/longevity/dated_tree.py docstring; pipeline/sources/tree.ts:1-8 -->

**Topology.** Each species' name (its MitoAge name, then its AnAge build 15 name if different) was
matched to an Open Tree taxon by the Open Tree's name service, exact matches only, within the context
Animals. The subtree of synthetic tree opentree16.1 induced by the matched taxa was then requested.
Taxa the synthetic tree does not contain were dropped and the request repeated. A species whose taxon the
synthesis maps onto an internal node is attached there as a tip. Nodes with one child were collapsed.
Polytomies were kept as they are, without resolving them: 2,305 of the 2,335 species are placed, under
2,229 internal nodes, 54 of which are polytomies.

<!-- src: pipeline/sources/tree.ts:74-92 (TNRS exact, context Animals), 166-235 (induced subtree, broken taxa,
unary collapse); public/data/README.md "Data notes" (2,305 of 2,335; 2,229 nodes); docs/manuscript/NOTES.md Q5
(54 polytomies) -->

**Ages.** For each internal node, TimeTree was asked for the age of the most recent common ancestor of up
to three NCBI taxa from each of its first 12 child clades. Its adjusted age was taken, or its precomputed
age when the adjusted age was missing or zero (TimeTree gives zero when a single study dates the node).
TimeTree dated 2,045 of the 2,229 internal nodes. Two adjustments followed. First, going from the tips to
the root, a node younger than its oldest child was raised to that child's age (61 nodes); this leaves
some branches of length exactly zero. Second, going from the root to the tips, each undated node was
placed midway between its parent's age and its oldest child's (184 nodes). Had the root been undated, it
would have been placed 10% above its oldest child plus 1 million years. Branch lengths are differences of
age, in millions of years. Of the 4,534 branches, 556 have length exactly zero.

<!-- src: pipeline/sources/tree.ts:138-164 (timetreeMrca), 249-303 (reps, monotone, interpolation, root rule,
lengths); public/data/README.md "Data notes" (2,045, 184, 61); docs/manuscript/NOTES.md Q5 (556 of 4,534
zero-length branches) -->

The code describes the midway placement as interpolation in the style of BLADJ; the records give no
further reason for it. The 30 species outside the tree are left out of every phylogenetic test; no
position or branch length is invented for them.

**Assumptions and what is not known.** The tree is one fixed topology with point ages, not an estimate with its uncertainty. Its polytomies may be real or may only mean that the synthesis cannot resolve them,
and nothing here distinguishes the two. 184 of the node ages are interpolated, and how much they move any
result has not been measured. The Open Tree and TimeTree answers build 2 read are kept; asked again on
2026-11-14, both services gave answers with the same content, and the tree came out byte-identical.

<!-- src: mitoage-pipelines docs/BUILD2_REPRODUCTION.md "With other inputs", variant "Fresh" -->

## S10. Correlation statistics

### S10.1 Two datasets

Correlations are computed twice, on two sets of species. Both leave out retired species and lifespans
that are estimated or of low or questionable quality. The quality filter was agreed at the start of build
2. The **default** dataset takes a lifespan from any source: of the 2,316 live species, 49 have an
estimated lifespan (they are also the 49 of low quality) and 65 a questionable one, which leaves 2,202.
The **AnAge-only** dataset takes AnAge lifespans alone, for comparison with release 1: of 1,741 live
species with an AnAge value, 31 are questionable, which leaves 1,710.

<!-- src: pipeline/steps/correlations.ts:36-48 (inDataset); docs/BUILD2_REPORT.md "Correlation datasets" and
"Lifespan source x quality"; plans/DATA_BUILD2_DECISIONS.md §3 -->

A third dataset was considered and not built: AnAge-only without the quality filter, closest to the 2016
analysis, which used every AnAge value. It would have cost about 20 seconds more of site build. The
maintainer has been asked and the default stands until an answer comes.

<!-- src: docs/BUILD2_OPEN_QUESTIONS.md item 3; docs/ROADMAP.md RM4 -->

### S10.2 Traits and scopes

Each mtDNA feature is correlated with 11 life-history traits: maximum lifespan, adult weight, birth
weight, metabolic rate, body temperature, female and male age at maturity, gestation or incubation time,
litter or clutch size, litters or clutches per year and growth rate. Each trait is log10-transformed; a
value of zero or below is treated as missing.

<!-- src: pipeline/steps/correlations.ts:13-34 -->

The tests are made within scopes: all species of the dataset; each class with at least 20 species in the
dataset; and each order with at least 20. A species with no name at a rank joins no scope at that rank.
Until 2026-11-15 the 41 species whose order is unknown were grouped under an empty name and tested
together as if they formed an order; that scope is gone, and 32 scopes remain in the default dataset
(Supplementary Table S1). Features of a single protein gene (its codons, amino acids, fourfold-site
composition and hydropathy) are tested only in all species and in classes. The reason, recorded with the
code, is that one gene of thirteen on one linked molecule is not an independent test, and that across
the order scopes such features would multiply the tests past any useful correction. Aggregates over the
13 genes, and the whole-genome features, are tested in every scope. A correlation needs at least 10
species with both values. The records give no reason for the thresholds of 20 and 10.

<!-- src: pipeline/steps/correlations.ts:27-28 (MIN_SCOPE_SPECIES, MIN_PAIRS), 52-88 (buildScopes,
isPerGeneCodon and its comment); docs/CHANGELOG.md (IC-8 entry) -->

In the default dataset this gives 1,414 lifespan tests in all species, 1,390 to 1,403 in each of the
four largest classes and 204 or 205 in each order. A feature that is constant within a scope is not tested there.

### S10.3 The correlation across species

For each feature, trait and scope: Pearson's r and Spearman's ρ (on average ranks) between the feature
and the log10 trait, over the species with both values. The p value is that of Pearson's r, two-tailed,
from the t distribution with n − 2 degrees of freedom; it is the p value used for the false discovery
rate and for every count. Spearman's ρ is reported and is used in no count.

<!-- src: pipeline/lib/stats.ts:101-160 (tTestTwoTailed, correlationPValue, pearson, rank, spearman);
pipeline/steps/correlations.ts:130-147 -->

### S10.4 The false discovery rate

The Benjamini–Hochberg procedure is applied within each family of tests that shares a dataset, a trait
and a scope, over all features tested there, the extended features included. It is not applied across
scopes or across traits. The records give no reason for drawing the families this way. Two consequences
follow. Adding features to the catalogue changes the q values of the old ones; when the extended features
joined, the counts of the main text were recomputed for that reason. And because the scopes overlap (a
mammal counts in all species, in Mammalia and in its order), counts summed over scopes count tests, not
distinct relationships.

<!-- src: pipeline/steps/correlations.ts:172-175 (one BH call per block = dataset x scope x trait);
pipeline/lib/stats.ts:171-185; docs/DECISIONS.md D7 ("published q values move"); docs/CHANGELOG.md (the
manuscript's numbers rebuilt on the committed feature catalogue) -->

### S10.5 The partial correlation on body mass

To separate lifespan from body size, for maximum lifespan only we also compute the first-order partial correlation of the feature and log10 lifespan given log10 adult weight:
(r_xy − r_xz r_yz) / √((1 − r_xz²)(1 − r_yz²)), over the species of the scope that have an adult weight,
when there are at least 10. Its p value uses the t distribution with n − 3 degrees of freedom. Adult
weight comes from AnAge only, so the partial correlation covers 1,384 of the 2,202 species in all species,
235 of the 827 ray-finned fishes and no non-chordate.

<!-- src: pipeline/lib/stats.ts:162-169; pipeline/steps/correlations.ts:123-153; docs/manuscript/NOTES.md
"Partial-correlation sample" -->

### S10.6 The test on phylogenetically independent contrasts

**What is computed.** For each feature, trait and scope, Felsenstein's independent contrasts of both
variables are computed on the dated tree (S9), pruned to the species of the scope that have both values.
The tree is visited from the tips to the root. At each node, the children that have values are taken in
the order the tree lists them. The first two give a contrast: the difference of their values divided by
√(v₁ + v₂), where v is each child's branch length plus any length carried up from below. They are
replaced by their weighted mean, (x₁v₂ + x₂v₁)/(v₁ + v₂), with the carried length v₁v₂/(v₁ + v₂). This
merged value then makes the next contrast with the third child, and so on. A polytomy is thereby resolved
as a ladder with internal branches of length zero, in the order of its children. When v₁ + v₂ is zero,
the two values are averaged and no contrast is made. A node with only one child that has values makes no
contrast and passes that child's value up, its own branch length added. The test statistic is the
correlation of the standardised contrasts through the origin, r = Σcₓc_y / √(Σcₓ² Σc_y²), over the m
contrasts; its p value is two-tailed, from the t distribution with m − 1 degrees of freedom. At least
three contrasts are needed.

<!-- src: pipeline/lib/stats.ts:197-253 (picCorrelation), 281-349 (picFast, used by the build);
src/data/index.ts:442-444 (compiled dated tree passed to computeCorrelations) -->

**What it does not do.** The degrees of freedom are not reduced for polytomies, as Purvis and Garland
(1993) proposed; here that would change about 1% of them. The standardisation is not checked against the
branch lengths, as Garland, Harvey and Ives (1992) proposed. The number of contrasts behind each test is
not stored in the correlation table. Two checks of the test are under way and are not reported here: a
comparison of this implementation with an established one (`ape::pic` in R), and a calibration run on
the cluster (`pipeline/pic-calibration.ts`) that gives each lifespan test a Brownian-motion null on the
dated tree, a null from permuting lifespan across the tips, a sign-flip p value and the branch-length
diagnostic of Garland, Harvey and Ives.

<!-- src: docs/manuscript/NOTES.md Q5; docs/manuscript/NOTES.md "Not yet done" -->

> AUTHOR: the check against `ape::pic` and the calibration (`docs/PIC_CALIBRATION.md` once its cluster run
> reports) are in progress. Insert their results here when they are done.

**What is not known.** In some clades the contrast test rejects far more often than chance would allow:
in Chondrichthyes 42.8% of 1,368 lifespan tests have a contrast p below 0.05, while 0.1% pass the false
discovery rate across species; in Rajiformes 38.7% of 191, and in Clupeiformes 35.0% of 200, with none
passing. We looked for the cause in the tree and did not find it there. Only 12 of the 2,229 contrasts
are standardised by a variance sum below 1 million years, and none below 0.01; the polytomies cost 75
degrees of freedom in all. The rejecting contrasts are not biased in sign either (54% positive in
Chondrichthyes). What the measurements do show is heavy tails: among the rejecting tests, |r| on
contrasts averages 0.43 in Chondrichthyes and 0.61 in Rajiformes, where |r| across species averages 0.09
and 0.19. A Student-t p value for a correlation through the origin of a few dozen contrasts dominated by
outliers does not describe that distribution. The permutation null is part of the calibration now being run; a second control for shared ancestry (a
phylogenetic regression with Pagel's λ over the same tests) has not been run. Until both are in, the contrast column should not be read in those
scopes. Supplementary Table S1 gives the share of tests each scope rejects on contrasts.

<!-- src: docs/manuscript/NOTES.md Q5; docs/manuscript/supplementary_table_S1_scopes.csv
(pic_rejection_rate_pct) -->

### S10.7 How the three controls combine, and what each count counts

The three controls are applied separately. The contrasts are not adjusted for body mass, and the partial
correlation is not adjusted for shared ancestry. The records give no reason for not combining them. A
test "passes all three" when its q value is below 0.05; its contrast p value is below 0.05 and its
contrast r has the same sign as its r across species; and its partial-correlation p value is below 0.05,
whatever the sign of the partial correlation. Neither the contrast nor the partial p value is corrected
for multiple testing, so these two steps rest on a nominal 5% level.

<!-- src: docs/manuscript/NOTES.md "Definitions used for Table 3"; docs/DECISIONS.md D8 (the MCP verdict
uses the same definitions) -->

The main text quotes several counts that look alike and differ in what they require and over which
scopes they are taken. All are for maximum lifespan in the default dataset:

| Count | Scopes | What it counts |
|--:|---|---|
| 15,904 | all 32, summed | lifespan tests |
| 5,439 | all 32, summed | tests with p < 0.05 across species |
| 4,299 | all 32, summed | tests with q < 0.05 |
| 3,008 | all 32, summed | tests with contrast p < 0.05, of either sign, whether or not they pass the false discovery rate |
| 896 | all 32, summed | q < 0.05, and contrast p < 0.05 with the same sign ("Both" in Table 3) |
| 547 | all 32, summed | the 896, and partial p < 0.05 of either sign ("All three") |
| 481 | all 32, summed | of the 547, those whose partial correlation keeps the sign of r |
| 1,168 | all species only | q < 0.05 |
| 496 | all species only | q < 0.05, and contrast p < 0.05 of either sign (the plot explorer, Figure 5B) |
| 291 | all species only | q < 0.05, and contrast p < 0.05 with the same sign ("Both" in Table 3) |
| 237 | all species only | "All three" |

<!-- src: docs/manuscript/mitoage2.md Table 3 and Figure 5 legend; docs/manuscript/NOTES.md "Where the numbers
come from" and "Figures" (496 vs 291) -->

So 896 and 291 apply the same rule, to 32 overlapping scopes and to one; 496 and 291 apply different
rules to the same scope, the explorer not requiring the same sign; and 547 adds the body-mass control to
the 896. The pipeline does not write these counts; they were made from the correlation table in an analysis session.
The script that draws Figure 1 recomputes Table 3 from the same table and refuses to draw if any count
differs.

<!-- src: docs/manuscript/NOTES.md row for Table 3 ("the counts were made in an analysis session, not by the
pipeline"); docs/manuscript/figures/figure-1-controls.ts -->

## S11. Reproducibility: what was checked, and what was not

The build was checked in three ways, and each covers a different part of it.

**The pipeline and its tests.** Build 2 is made by one command of the site repository, `bun run data`, a
TypeScript pipeline that reads the pinned inputs, stops if one is missing, and ends with a validation
step. The validation checks, among other things, that each species' status agrees with the changelog,
that AnAge comes first wherever it has a value, and that no committed output exceeds GitHub's file-size
limit. `bun run align` makes the alignments; the site build computes the correlations and the explorer's
data. At build 2 the pipeline had 192 tests; the repository had 303 on 2026-11-15. When a test of a build
rule was written, it was checked by breaking the code it guards and confirming that the test then fails.
Seventeen such checks are listed in `docs/BUILD2_REPORT.md`, among them removing the AnAge-first rule,
resolving ambiguous name matches instead of refusing them, and dropping the full-span rule of the
changelog.

<!-- src: docs/BUILD2_REPORT.md "Commands" (192 tests, the table of 17 breaks); pipeline/validate.ts;
docs/DECISIONS.md D4 (100 MB / 50 MB); bun test on 2e9c5d4 in this worktree, 2026-11-15: 303 tests, 293 pass,
10 skipped, 0 fail -->

**The cross-check against a separate audit.** The sources were first downloaded and audited by
separate scripts in Python. The pipeline reads the audit's downloads but none of its tables; the audit
tables are compared with the pipeline's output by `bun run pipeline/crosscheck.ts`, and are used only
for that comparison. On the 1,413 new
species the two agree on the species set and on every field compared: lifespan value, source, quality,
RefSeq record, name, order, family, common name and AnAge sample size. The exceptions are class, where
the audit labelled the 4 new lampreys Hyperoartia rather than release 1's Cephalaspidomorphi, and the
source record and record type of 154 species, which are the tied values of S4. On the original
species, the two record 3,325 changed values for the same table, row and field, and agree on the old and
new value of 99.0% of them. Every other difference is traced to a named design choice. The largest are
that the pipeline moved 18 species to a successor record where the audit retired them, which accounts
for almost all of the 5,408 rows only the pipeline has, and that class labels were not taken from AnAge
build 15. The audit scripts are not published.

<!-- src: docs/BUILD2_CROSSCHECK.md §1-§5; docs/BUILD2_REPORT.md "Cross-check with the audit" and "Not done"
("The Python audit scripts and tables stay outside the repository") -->

> AUTHOR: the audit's scripts are not in any repository. Either publish them, or describe the
> cross-check in the paper as a comparison with an unpublished audit.

**The independent reproduction.** A second repository, `dna-seq/mitoage-pipelines`, rebuilds build 2 in
Python for readers who want to rebuild without our machines. It was written from the rules as stated, not
translated line by line from the TypeScript. It reads the published build in one place only, the final
comparison, so that no value is filled from the source that checks it. Every input has a downloader, and
the inputs no archive keeps come from the snapshot dataset of S1. From the pinned inputs, all 5,302,404
values of the seven tables (species, region statistics, codon usage, genome features, lifespan
observations, changelog and review list), all 28 alignment files and the dated tree come out identical:
the values compared exactly, the alignments by SHA-256, the tree byte for byte. The whole sequence takes
about seven minutes.

<!-- src: mitoage-pipelines docs/BUILD2_REPRODUCTION.md (opening, "How far it reproduces", run times total 429 s) -->

The reproduction was also run with other inputs, to show what moves when a source does. With the
taxonomy archive of 2026-11-01 instead of the dump of 2026-11-13, four species change, because NCBI
renamed or split taxa in between; this is why the snapshot keeps the later dump. With build 2's record
versions fetched by efetch instead of read from release 237, the only change of values is *Pongo
pygmaeus*, which NCBI re-annotated in place after the release. With every source as it was on
2026-11-14 (RefSeq release 238, the next day's taxonomy, live Open Tree and TimeTree), the species set is
the same, and every difference other than *Pongo pygmaeus* is the name of an input version.

<!-- src: mitoage-pipelines docs/BUILD2_REPRODUCTION.md "With other inputs" -->

The comparison was made against revision 653afe2a… of the Hugging Face dataset. The paper cites revision
c525adbf…, uploaded later with the SQLite file of S13. The seven tables and the 28 alignment files carry
the same SHA-256 in both revisions (and in revision 6efa0959… used by the worked analyses); the two
extended-feature tables exist only in c525adbf….

<!-- src: checked on 2026-11-15 with huggingface_hub (dataset_info, files_metadata) on the three revisions:
species, region_stats, codon_usage, genome_features, lifespan_observations, changelog parquet and review_list.csv
have identical LFS SHA-256 / blob ids; 28 of 28 alignment files identical between 653afe2a and c525adbf;
mtdna_structure.parquet and protein_gene_features.parquet only in c525adbf (SHA-256 ac6a0cde..., 71170821...,
equal to public/data/ at 2e9c5d4) -->

**What none of the three covers.** The two tables of extended features (S7.3) were added to the build
after the reproduction and are not part of its comparison. The correlations are not reproduced
independently at all. They are computed during the site build, the reproduction stops before them, and
the audit does not compare them. So the correlation table, Table 3, Supplementary Table S1, Figures 1 and
2, and every r, q, contrast and partial value of S10 quoted in the main text rest on the TypeScript code
of S10 and its tests alone. The comparison with `ape::pic` (S10.6) would check part of that code against
another implementation. The Abstract's phrase "an independent reproduction of the build" should be read
with this limit.

<!-- src: mitoage-pipelines docs/BUILD2_REPRODUCTION.md "Known gaps" (last item); docs/manuscript/mitoage2.md
"Reproducibility" -->

**The analyses.** The worked analyses of S12 are commands of `mitoage-pipelines`, and its README records
which of its commands reproduce on a rerun. Byte-identical: the amino-acid composition and fourfold
tables, the earlier tree-free and mixed-model tests, the column screen on the dated tree, the peptide
pilot and several preparation steps. Equal to the second decimal: the rate-covariation test of the
mitochondrial and nuclear subunits, because MAFFT run on several threads and IQ-TREE run without a seed
are not repeatable. Not reproducing: HyPhy RELAX, whose optimiser landed on different optima on
identical inputs, which is one reason no RELAX result is claimed. The README records no rerun of the
three commands behind the other numbers of the main text: the amino-acid regression on the tree, the
motif regression and the rate test.

<!-- src: mitoage-pipelines README.md "How far it reproduces": identical bytes for controls, fourfold, composition,
sites, pgls, peptides pilot, relax-prep, coevol-prep, mitoport select; aa-pgls, motif-pgls and rates are not
listed -->

> AUTHOR: `mitoage longevity aa-pgls`, `motif-pgls` and `rates` produce every number of the main text's
> two worked-analysis subsections, and none is recorded as rerun. A rerun compared with the first run's
> tables would close this.

<!-- src: mitoage-pipelines README.md "How far it reproduces" -->

## S12. The worked analyses

The main text reports four analyses that use the database the way a reader could: the amino-acid content
of the 13 proteins, a screen of single alignment columns, the repeat and motif features, and the rate of
protein evolution. All four are in `mitoage-pipelines`, each run by one command, and all share one
design. They use the species of the default dataset (S10.1) that have a body mass and a tip in the dated
tree. They use the dated tree of S9 and never a tree built from the genes. And every model that tests
lifespan includes body mass and base composition at fourfold-degenerate sites, the latter as a measure
of mutational pressure.

<!-- src: docs/ANALYSIS_FINDINGS.md H1 (hypothesis, test), H2 ("Fixed before any result"); mitoage-pipelines
docs/PIPELINE.md ("Every model that tests lifespan carries body mass and base composition at fourfold-degenerate
sites") -->

The composition covariates are the shares of A, C and T at fourfold-degenerate third positions over the
12 genes other than ND6, read in gene sense from the codon alignments. Fourfold families here are the
eight that are fourfold degenerate in every animal mitochondrial code (first two bases CU, GU, UC, CC, AC,
GC, CG and GG). This differs from the site's fourfold features (S7.3), which derive the families from each
record's own code. Body mass is log10 AnAge adult weight.

<!-- src: mitoage-pipelines src/mitoage_pipelines/longevity/fourfold.py (FOUR, MT_HEAVY_STRAND);
src/mitoage_pipelines/genes.py -->

### S12.1 Amino-acid content (H1)

**Background.** Long-lived animals have been reported to carry fewer cysteines (Moosmann and Behl, 2008)
and less methionine (Aledo et al., 2011) in their mitochondrially encoded proteins, and higher primates
more threonine in their transmembrane regions (Kitazoe et al., 2008). A study of 173 mammals found no effect of longevity on cysteine content, and threonine usage fully accounted for by nucleotide composition (Aledo, Valverde
and de Magalhães, 2012). We tested all 20 amino acids and read cysteine, threonine and methionine against
this record, as tests rather than as positive controls.

**Model.** The response is the percentage of each amino acid over the 13 proteins. It is regressed on
log10 maximum lifespan and log10 body mass ("mass"), and then also on the three composition shares
("mass+composition"). The regression is a phylogenetic generalised least squares. The covariance between
two species is the length of the path they share from the root of their class's subtree on the dated
tree (Brownian motion), with its off-diagonal elements multiplied by Pagel's λ. λ is estimated by maximum
likelihood within [0, 1], separately for each amino acid and model. The slope of log10 lifespan is in
percentage points per tenfold lifespan, tested by its t statistic with n − p degrees of freedom. The q
values are Benjamini–Hochberg over the 20 amino acids, within class and model. The code is our own
(NumPy and SciPy), not a phylogenetics package.

<!-- src: mitoage-pipelines src/mitoage_pipelines/longevity/aa_pgls.py (models, fit, class_covariance, q);
src/mitoage_pipelines/longevity/pgls.py (shared_path_covariance, V, nll, gls) -->

**Species.** In mammals: 625 with all 13 proteins and a lifespan, 615 in the default dataset, 612 with a
body mass and 604 in the tree. Birds, ray-finned fishes and reptiles were tested the same way (379, 235
and 97 species).

**Why a tree, and not the earlier mixed model.** The first version of this test used random intercepts
of order and family in place of a tree. Refitted on the same 604 mammals, it gives seven amino acids at
q < 0.05, cysteine and threonine among them; on the dated tree, with λ between 0.96 and 1 for every amino
acid, none passes. Random intercepts of order and family leave most of the shared ancestry in the
residual, and the tree takes it out. Both versions are kept in the output table (methods `pgls` and
`mixed`), so that the effect of the tree can be told apart from the effect of the species set. An
earlier run that reported threonine and cysteine as positive controls had included 10 mammals with
questionable lifespans; it is kept in the analysis record as a lesson.

<!-- src: docs/ANALYSIS_FINDINGS.md H1 (results, "What changed the result", "Earlier version") -->

**Limits.** Composition is three shares over 12 genes, a coarse measure of mutational pressure. The
tree's polytomies are used as they are. Each species has one lifespan. The test is over whole proteins
across mammals, so it does not test Kitazoe et al.'s claim about transmembrane regions in higher primates.

### S12.2 The screen of single alignment columns (H2)

**Hypothesis.** Some positions of the 13 proteins carry a residue more often in long-lived species,
independently in several lineages.

**Model.** For each column of each protein alignment with at least 80% of the species ungapped, and each
residue in it present in at least 15 species and absent in at least 15, with both states occurring in at
least 5 families: a phylogenetic regression of log10 lifespan on log10 body mass, the three composition
shares and an indicator of the residue. Pagel's λ is estimated once, on the model without the residue,
and held fixed for every column. The q values are Benjamini–Hochberg over all tests in the class (5,259
in mammals).

<!-- src: mitoage-pipelines src/mitoage_pipelines/longevity/pgls.py:main (ok.mean() < 0.8; x.sum() < 15;
poly < 5; lambda on null model; BH over all rows); docs/ANALYSIS_FINDINGS.md H2 (power: 0.05/5,259) -->

**How it got here.** The first version compared species within families without a tree, and its p values
were inflated over their whole range, since genera within a family are not independent. The second
version used a phylogenetic regression, but on a tree built from the 13 proteins themselves and on every
lifespan record, against the rule of S9. It reported cytochrome b position 43 as "the one site" (q =
0.03). Rerun as the rule required, that site has q = 0.29. As fixed, two columns pass in mammals and none
in birds. The rule of S8 for genes where aligners disagree applied to one of them, ND5 position 200: on
the FAMSA, Muscle 5 and iterative MAFFT alignments, both columns hold the same residues in the same
species and pass again. A power calculation from the tests' own standard errors shows the screen detects
only large effects, about 1.3- to 1.5-fold lifespan. Without a replication, the main text reports neither column as associated with lifespan.

<!-- src: docs/ANALYSIS_FINDINGS.md H2 -->

### S12.3 Repeats, motifs and deletion contact zones (H8)

**Background.** Non-B DNA motif counts were proposed as longevity features by the MitoAge group itself
(Toren et al., 2021), inverted repeats were reported to correlate with lifespan in mammals (Yang, Seluanov
and Gorbunova, 2013), and the repeats that flank deletions sit in two defined zones (Persson et al.,
2023).

**Model.** The features are read from the published table `mtdna_structure.parquet` (S7.3), never
recomputed, so what is tested is what the database publishes. The model is that of S12.2 with the
feature in place of the residue: a phylogenetic regression of log10 lifespan on the standardised
feature, body mass and composition, on the dated tree. λ is estimated once per class on the model
without the feature and held fixed. A slope is the change in log10 lifespan per standard deviation of the feature. Features need
at least 25 species. q is Benjamini–Hochberg within class. Spearman's ρ is reported on the same species.
Four classes give 132 tests.

<!-- src: mitoage-pipelines src/mitoage_pipelines/longevity/motif_pgls.py (MIN_SPECIES 25, lambda once per class,
z-standardisation, q within class and subset); docs/ANALYSIS_FINDINGS.md H8 -->

The contrast and partial correlations the main text quotes beside these results (for example r = 0.02
on contrasts over 615 mammals for inverted repeats) come from the database's correlation table (S10),
which uses all mammals of the default dataset that have the feature. The phylogenetic regression uses the
604 that also have a body mass and a tip in the tree.

**Control planned and not run.** Every test was to be repeated on records assembled from long reads,
because long-read assemblies recover repeats and control regions that short-read assemblies miss. Of
the records matched in release 237, one states a sequencing technology, and the long-read subset of the
build is empty; the analysis reports
the subset as not assessed rather than leaving it out silently.

**Three runs, three different survivors.** An exploratory Python run over 2,311 species, with
tandem-repeat counts that did not reject units built from a shorter period, gave mammalian
G-quadruplexes at q = 0.048. Rerun on the database's own features while they covered only 922 species,
that was gone (q = 0.66) and a reptile G-quadruplex test passed instead (q = 0.027). On the full build
that is gone too (q = 0.38), and nothing passes. The main text reports the third run and calls the
screen null.

<!-- src: docs/ANALYSIS_FINDINGS.md H8 ("What this replaced, twice"); docs/manuscript/NOTES.md "Two results that
were withdrawn" -->

### S12.4 The rate of protein evolution (H7)

**Background.** Lifespan has been reported to predict a slower mitochondrial substitution rate (Galtier,
Blier and Nabholz, 2009, and later work in bivalves and fishes). A survey across vertebrates found that
whether the association appears depends on how the rate is normalised (Hernandez-Pacheco et al., 2026).

**Why the relative-rate test.** Two tips of the dated tree that share a parent (a cherry) have had the
same time since they split. Measured against one common outgroup, the difference of their distances is a
rate contrast that needs no correction for divergence time. This removes the normalisation choice that
divides the literature. Cherries are taken where a node has exactly two children, both tips and both
usable; a polytomy gives none. The outgroup is the nearest usable tip outside the cherry by tree
distance.

**Model.** dN and dS of each sister against the outgroup are Nei–Gojobori counts with the Jukes–Cantor
correction. They use the genetic code the three species share, or code 2 when they differ. Codon pairs
that differ at more than one position are averaged over every mutational pathway that avoids a stop.
Codon pairs with a gap, an ambiguous base or a stop are skipped, and at least 30 codons are needed. Each
rate contrast is regressed through the origin on the lifespan contrast, per gene and over the
concatenated 13 genes, with at least 12 contrasts. Because the choice of rate is what moves results in
the published record, five forms are tested: the raw difference of dS and of dN, the difference of dS per
million years (divided by the mean branch length of the cherry), the difference of dN/dS, and the raw
difference of dS with the body-mass contrast in the model. A sign test on the same pairs asks directly
whether the longer-lived sister has the lower rate. Pairs whose dS exceeds 1 are flagged as saturated,
and every test is reported with and without them. q is Benjamini–Hochberg within class, rate form and
saturation filter.

<!-- src: mitoage-pipelines src/mitoage_pipelines/longevity/rates.py (docstring, MIN_CODONS 30, MIN_CONTRASTS 12,
NORMALISATIONS, cherries, outgroup_for, test_contrasts, q grouping); docs/ANALYSIS_FINDINGS.md H7 -->

**Species and limits.** The default dataset gives 1,369 species with a tip in the tree and 339 cherries.
dS exceeds 1 in 24.2% of the concatenated pairs. A cherry gives one contrast, so the test uses 339 of
the 1,369 species. Nei–Gojobori counting suits close pairs and is strained at the divergences a quarter
of these cherries reach, which is why saturated pairs are flagged and kept.

### S12.5 Analyses run and not reported in the main text

The analysis repository holds further tests that the main text does not report: selection on the
mitochondrial genes in long-lived against short-lived lineages (HyPhy RELAX, which did not reproduce
between draws or between runs; and Coevol, whose chains had not converged); the conservation of the
peptides encoded inside mtDNA (none beyond a null of random windows); the co-evolution of mitochondrial
and nuclear subunits of the respiratory complexes, whose per-residue ESM-2 embeddings are published as
`longevity-genie/mitoage-embeddings` (revision fc70053); and lifespan against mismatch at the contacts of
complex IV (a bounded null). They are described, with their failures, in `docs/ANALYSIS_FINDINGS.md` of
the site repository and `docs/HYPOTHESES.md` of the analysis repository.

<!-- src: docs/ANALYSIS_FINDINGS.md H3, H4, H5, H6, H9 -->

## S13. The MCP server

A language-model agent asked whether an mtDNA feature predicts lifespan, with only the downloads to hand,
would take a table and correlate two columns, the uncontrolled estimate this release argues against. The
experimental Model Context Protocol server `mitoage-mcp` serves the same build to such agents in a form
that keeps the controls attached.

**Where it lives.** In the site repository, as the directory `mcp/` and a separate npm package, rather
than in a repository of its own. The maintainer regarded it as an experimental extra; a repository of its
own would have needed its own CI, README, issue handling and release process for a feature that may find
no users, and the directory can be split out later with its history.

**Language.** TypeScript, so that it type-checks against the same data contract (`src/data/schema.ts`) as
the site, in the same check. A Python server, as the other Longevity Genie servers are, was rejected
because this repository holds no Python and it would have meant a second toolchain.

**Storage.** One SQLite file holding a table per download plus the correlations, rather than the Parquet
files: the correlation table is 203,648 rows and 56 MB as an Arrow table, and an indexed SQLite file answers a
lookup in constant memory with no native dependency. Each table of the SQLite file is checked against the
Parquet file it came from by row count and by per-column sums.

**Pinning.** The server reads one revision of the Hugging Face dataset, named by a full commit
identifier, never a branch. It refuses to start rather than fetch the newest file, and the release
workflow refuses to publish while no revision is set. A database that is cited has to give the same answer
tomorrow.

**No bare coefficient.** No correlation tool returns r on its own. Each answer carries the q value, the
partial correlation on body mass, the correlation on contrasts, the filters of the dataset and a verdict
that uses the definitions of S10.7. A control that was never computed is reported as not assessed, not as
a failure. The tools are: build information, species search, a species profile, one correlation, features
ranked by their correlation with a trait, a summary of a region across a scope, and one read-only SQL
query. The query tool returns whatever columns it is asked for. Its description tells the agent to keep
the q value and both controls beside the coefficient, but nothing enforces it.

<!-- src: docs/DECISIONS.md D8 and D9; mcp/README.md; docs/CHANGELOG.md (MCP entries: sqlite checked by row
count and per-column sums; seven tools) -->

## S14. What the authors must still supply

The questions raised above, in one place:

1. **The strand convention** (S5): whether the 2015 pipeline meant the heavy strand or the deposited one
   (NOTES.md, Q1).
2. **The record-choice order** (S2): whether "newest, then full length" is the intended order.
3. **The thresholds of the repeat and motif features** (S7.3): their source, if any.
4. **The aligner comparison** (S8): the versions and options of FAMSA, Muscle 5 and the iterative MAFFT
   run, and the comparison for the 11 genes not yet rerun.
5. **The contrast test** (S10.6): the results of the comparison with `ape::pic` and of the calibration,
   and a decision on a phylogenetic regression over the correlation table for the scopes that
   over-reject.
6. **The audit** (S11): publish its scripts, or describe it as unpublished.
7. **The reach of the reproduction** (S11): extend it to the two extended-feature tables, and decide
   whether the correlations get an independent check; until then the Abstract's "independent
   reproduction" covers the tables, alignments and tree, not the correlations.
8. **The open calls of build 2** (S3, S10.1): the defaults put to the maintainer (the identifiers of new
   species, the records that now resolve to another species, a third correlation dataset, order and
   family), listed in `docs/BUILD2_OPEN_QUESTIONS.md`.
9. **EURING** (S4): its 26 provisional bird lifespans, once the list can be retrieved.
