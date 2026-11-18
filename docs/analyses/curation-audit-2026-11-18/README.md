# Curation audit of build 2, 2026-11-18

Asked by the maintainer after the first author of the 2015 MitoAge reported mistakes in nomenclature, synonyms and
"other species and sequence aspects" of the curation; his own list was not available. An independent agent checked
every species of the committed build by script against the pinned sources (NCBI taxonomy dump of 2026-11-13, RefSeq
mitochondrion release 237, AnAge build 15, FishBase and SeaLifeBase 26.06, the committed alignments) and NCBI's
record summaries of the day. It changed nothing. `SPECIES_QUALITY.tsv` is its table: one row per species, one column
per check (ok, issue, not checked) and a proposed grade with the rule that gave it. The grade is a proposal, not yet
a column of the build (roadmap, RM25).

Checked a second time by the lead, from the committed tables and alignments with separate code: the three
reverse-complement records (total GC skew +0.27 to +0.28 where other vertebrates are negative), and the identity of
*Vipera berus* with *Echis coloratus* (COX1 1,599 of 1,599, CYTB 1,113 of 1,113, ND5 1,785 of 1,785), of *Tadorna
tadorna* with *Anas platyrhynchos* (COX1 1,548 of 1,548; 90% to *T. ferruginea*), of *Seriolella porosa* with
*Piaractus brachypomus* (COX1 1,553 of 1,554; ND5 82%, so a chimera) and of *Metachirus nudicaudatus* with *Didelphis
marsupialis* (99.7 to 99.9% in three genes). The other findings are the auditor's, verified by it as it states.

## Verdict

- **Names against NCBI: clean.** 2,342 of 2,344 names equal NCBI's name for their species taxid; the other two were
  flagged already. What a taxonomist may object to is the authority: NCBI's names differ from AnAge's for 97 species
  and from FishBase's or SeaLifeBase's for 31 (synonyms and spellings, recent genus splits).
- **Lifespans attached through another name: sound.** All 115 synonym matches and all 26 common-name matches are the
  same taxon; no source record feeds two species.
- **Sequence records: the real problem.** 13 live species carry a mitogenome that by its own sequence is another
  species' or a chimera; 3 records are deposited as the reverse complement, so every skew computed for them has the
  wrong sign; 3 genomes are truncated. 18 of these 19 were in the default correlation dataset and one had a flag.
- **Higher ranks mix two schemes.** 39 families (268 species) sit under two order values; 44 new species have no order
  (open question e; desk question on one taxonomy).
- **Lifespan values.** The AnAge-first rule keeps a value at least 1.5 times lower than a reported value of another
  source for 87 species (2 times for 26); 35 chosen values are ringing-scheme minimum ages, six far below their clade.

| Proposed grade | Species | In the default dataset |
| --- | ---: | ---: |
| A, usable | 1,718 | 1,718 |
| B, usable with a named caveat | 467 | 467 |
| C, left out of regressions and machine learning | 159 | 26 |

## The sequence findings

| Species (record) | Evidence |
| --- | --- |
| *Vipera berus* NC_036956.1, *Echis coloratus* NC_060592.1, *Echis carinatus* NC_060591.1 | 99.97 to 100% pairwise over the 13 protein genes: three names, one genome; which name is right is not resolved |
| *Tadorna tadorna* NC_024750.1 | 99.96% to *Anas platyrhynchos* NC_009684.1; the record's breed is a domestic duck |
| *Seriolella porosa* NC_025665.1 | 99 to 100% to *Piaractus brachypomus* (another order) in 12 of 13 genes |
| *Metachirus nudicaudatus* NC_006516.1 | 99.7% to *Didelphis marsupialis* NC_057518.1 |
| *Carcharhinus acronotus* NC_024055.1, *Negaprion brevirostris* NC_072260.1 | 99.8%; the *Negaprion* record is the likelier mislabel (inference) |
| *Netuma thalassina* NC_030323.1, *Arius maculatus* NC_045222.1 | 99.8%, two genera; not resolved |
| *Agapornis lilianae* NC_045369.1, *A. pullarius* NC_045368.1 | 0 differences in 11,280 bases |
| *Netta rufina* NC_024922.1 | chimera: COX2 99.6% and COX1 94.4% to a pheasant, the other genes 93 to 98% to *Aythya* |

- Flagged before and still in the default dataset: *Carassius auratus* NC_002079.1 (the record is *C. langsdorfii*) and
  *Bubalus bubalis* NC_006295.1 (*B. kerabau*).
- Reverse complement: *Pseudocaranx dentex* NC_058961.1, *Dasycercus cristicauda* NC_057634.1, *Pseudoscaphirhynchus
  hermanni* NC_058992.1.
- Truncated: *Bagrus docmak* NC_061386.1 (12,946 bp, no rRNA), *Paleosuchus palpebrosus* NC_009729.1 (14,935 bp, no
  control region), *Homarus gammarus* NC_020020.1 (14,316 bp, ND2 absent).
- Candidates, grade B: 36 pairs of one genus at 99.5% or more; single genes matching another family (*Plectropomus
  leopardus* ND4L, *Sillago sihama* CYTB); 41 rows whose record is a subspecies' and 9 with a breed, in 22 of which a
  species-level record exists in the release and was not used; 26 linear records; 23 with 50 or more ambiguous bases;
  61 genome sizes outside 0.95 to 1.15 of the order's median; 20 species with a gene annotated twice.
- For the analyses: 60 clusters at 99% identity hold 131 species.

## Retired and renamed records

All 19 retirements and all 46 renames are justified by the sources. The other 2,326 accessions are live at the same
version under the same organism.

## Not checked

Other authorities (IOC, the Mammal Diversity Database, the Reptile Database, Amphibian Species of the World, the
Catalog of Fishes); published lists of misidentified mitogenomes; records whose true species is not in the database;
internal stops and nuclear copies by translation; double counting of duplicated control regions or genes; lifespan
values against the primary literature; which of two near-identical records carries the wrong name.
