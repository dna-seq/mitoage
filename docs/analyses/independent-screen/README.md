# Every record against independent sequences of its species

RM25, item 1. The audit of 2026-11-18 compared with independent sequences only the records of near-identical pairs.
This screen does it for every live record: its COX1 and CYTB against GenBank sequences of the species it is named
for, and of each other species of its genus in the database.

**It is a screen. No row here is a finding.** Nothing in the build is flagged from it: a row joins the list of
audited records (`pipeline/curation/sequence-audit.ts`) only after a person read it. No row below was read by a
person yet.

## Method

- Independent sequences: nucleotide records of the species' taxon that name the gene, 300 to 3,000 bases long, not
  RefSeq and not a genome project's master record; the first 15 that NCBI returns. The length bound keeps whole
  mitochondrial genomes out, so the record under test is not among them. Searched on 2026-11-20 and 2026-11-21
  (UTC): 4,650 searches for 2,325 species, 44,193 sequences; 416 searches found none, and 2,153
  found more than the 15 that were taken.
- Comparison: an overlap alignment of the record's gene, as the committed codon alignment has it, with each
  sequence on either strand. A comparison sharing fewer than 300 bases, or below 65% identity (another gene), is
  left out and never counted as a difference.
- Verdicts, with thresholds written before the run (`pipeline/lib/screen.ts`). A record takes the first that
  holds, in the order closer to another species, genes disagree, differs, mixed, agrees, differs in one sequence, not assessed.
- Run: `bun run screen compare` as array job 6565328 (8 tasks, about 6 minutes each) from commit 40e3a27, then
  `bun run screen summarize`. The sequences were fetched from 2eec451 and, for four searches, 40e3a27, which added
  the exclusion of master records and changes no other set.

## Files

- `SCREEN.tsv`: one row per live species, with its level, the audit's finding if it has one, the verdict and, per
  gene, the number of comparable sequences, the median, highest and lowest identity (%), and the closer species.
- `COMPARISONS.tsv`: one row per record, gene and species compared (the record's own and the others of its genus),
  with the accession of the best-fitting sequence.

## Counts

| Verdict | Records | Meaning |
|---|---|---|
| agrees | 1,771 | every gene that could be read has a median identity of 97% or more to its own species' sequences |
| mixed | 243 | the median is below 97% and at least one sequence is at 97% or more: the species' public sequences are of more than one kind |
| differs | 153 | a gene has two or more sequences, none at 97% |
| genes disagree | 69 | one gene agrees and the other differs |
| closer to other species | 43 | a gene fits another species of the genus at 98% or more, at least one point above its own species |
| differs one sequence | 11 | the only evidence against is a single sequence |
| not assessed | 35 | no independent sequence of either gene could be compared |

519 of 2,290 assessed records do not agree. That is far more than can be wrong records, and
it is what the thresholds give: many species differ by more than 3% within themselves, a name at NCBI can cover
several lineages, and a GenBank sequence can itself be misnamed. Among assessed records the share is 30% in
mammals (183 of 610), 38% in reptiles (47 of 125), 20% in ray-finned fishes (177 of 889) and 14% in birds (60 of
421). "Agrees" is support for the record's name, from sequences other people deposited; "differs" and "mixed" are
reasons to look, most of which will end with the record standing.

## Check of the method on the audit's records

Of the 44 audited records, 17 were found by independent sequences in the audit. The screen gives all 17 a verdict
other than "agrees": 12 closer to another species, 5 differs. Of all 27 records the audit lists as another species',
25 do not agree; the two that agree (*Rallus aquaticus* NC_041578.1, *Hemiculter leucisculus* NC_022929.1) were
listed from published papers, not from sequences, and the public sequences of their names fit them. None of the 6
chimeras agrees. The records listed for other reasons (truncated, sequencing errors, a specimen's qualifier) mostly
agree, as they should: this screen cannot see those problems.

## Rows to read first

Both genes fit one other species of the genus better than the record's own, and the record is not on the audit
list: 14 records. Identity in %, number of sequences in brackets; first to the record's own species, then to the
closer one.

| Species | Record | Class | COX1 | CYTB |
|---|---|---|---|---|
| *Acipenser sinensis* | NC_012646.1 | Actinopterygii | 93.83 (15); *Acipenser gueldenstaedtii* 100.00 (15) | 92.54 (4); *Acipenser gueldenstaedtii* 99.53 (15) |
| *Amazona ochrocephala* | NC_027840.1 | Aves | 98.20 (14); *Amazona aestiva* 99.60 (15) | 97.97 (10); *Amazona aestiva* 99.02 (10) |
| *Anarhynchus leschenaultii* | NC_070231.1 | Aves | 97.24 (15); *Anarhynchus mongolus* 100.00 (15) | 96.88 (8); *Anarhynchus mongolus* 99.86 (15) |
| *Aythya marila* | NC_068663.1 | Aves | 98.99 (15); *Aythya fuligula* 100.00 (14) | 97.12 (1); *Aythya fuligula* 99.84 (10) |
| *Callithrix penicillata* | NC_030788.1 | Mammalia | 98.10 (2); *Callithrix jacchus* 99.34 (5) | 97.63 (7); *Callithrix jacchus* 98.68 (15) |
| *Carassius carassius* | NC_006291.1 | Actinopterygii | 93.47 (15); *Carassius gibelio* 99.53 (15) | 91.38 (15); *Carassius gibelio* 98.19 (15) |
| *Cebus albifrons* | NC_002763.1 | Mammalia | 98.67 (15); *Cebus olivaceus* 99.85 (3) | 96.63 (14); *Cebus olivaceus* 98.85 (15) |
| *Crocodylus siamensis* | NC_008795.1 | Reptilia | 91.17 (15); *Crocodylus porosus* 99.34 (15) | 94.08 (6); *Crocodylus porosus* 98.27 (13) |
| *Lepisosteus osseus* | NC_008104.1 | Actinopterygii | 94.54 (15); *Lepisosteus oculatus* 99.71 (15) | 89.70 (15); *Lepisosteus oculatus* 99.73 (15) |
| *Mareca americana* | NC_088449.1 | Aves | 97.53 (9); *Mareca penelope* 100.00 (15) | 96.83 (1); *Mareca penelope* 98.99 (2) |
| *Mareca penelope* | NC_050973.1 | Aves | 96.83 (15); *Mareca strepera* 98.39 (15) | 95.63 (2); *Mareca strepera* 98.41 (15) |
| *Naja naja* | NC_010225.1 | Reptilia | 92.05 (12); *Naja atra* 99.27 (15) | 90.26 (15); *Naja atra* 99.35 (15) |
| *Sander canadensis* | NC_021444.1 | Actinopterygii | 87.58 (14); *Sander lucioperca* 99.22 (15) | 86.63 (15); *Sander lucioperca* 98.95 (15) |
| *Tringa melanoleuca* | NC_088456.1 | Aves | 95.33 (15); *Tringa nebularia* 99.38 (15) | 93.82 (2); *Tringa nebularia* 98.97 (2) |

One gene only is closer to another species (17 records, in `SCREEN.tsv`): weaker, since one misnamed
barcode series can do it.

## The pairs the audit left unresolved

For the inspection by eye (RM25, item 6): what this screen adds to the audit's second round
(`docs/analyses/curation-audit-2026-11-18/SPECIES_QUALITY_ROUND2.tsv`, column `r2_independent_sequence_verdict`).

| Species | Record | Verdict | COX1 | CYTB |
|---|---|---|---|---|
| *Netuma thalassina* | NC_030323.1 | mixed | 92.65 (15) | 99.76 (6) |
| *Arius maculatus* | NC_045222.1 | genes disagree | 100.00 (15) | 93.31 (6) |
| *Caranx melampygus* | NC_004406.1 | mixed | 94.07 (15) | 90.28 (1) |
| *Caranx tille* | NC_029421.1 | differs | 94.59 (15) | 91.10 (2) |
| *Eubalaena glacialis* | NC_037444.1 | closer to other species | 99.13 (3) | 98.84 (12); *Eubalaena australis* 99.91 (3) |
| *Sebastes norvegicus* | NC_056783.1 | closer to other species | 98.78 (15) | 98.49 (2); *Sebastes viviparus* 99.65 (3) |
| *Cebus albifrons* | NC_002763.1 | closer to other species | 98.67 (15); *Cebus olivaceus* 99.85 (3) | 96.63 (14); *Cebus olivaceus* 98.85 (15) |
| *Ateles chamek* | NC_064190.1 | mixed | 99.29 (1) | 96.92 (6) |
| *Ateles marginatus* | NC_064192.1 | not assessed | not assessed | not assessed |
| *Equus hemionus* | NC_016061.1 | agrees | 99.26 (9) | 98.28 (11) |

What to look at in each: the record's own paper and voucher (the specimen's locality against the species' range),
whether the independent sequences come from one laboratory or several, and for *Equus hemionus* NC_016061.1 its
paper's title, which names *E. kiang*.

## Limits

- Two genes of 13; a chimera in other genes passes.
- A species with no independent sequence is not assessed (35 records), and one compared with a single sequence
  rests on that sequence.
- Only species of the same genus in the database are tried as the closer one: a record that is a species of
  another genus, or one not in the database, shows as "differs" at most.
- The first 15 sequences NCBI returns are not a sample of the species: one study's series can fill them.
- Independence is by record, not by laboratory: the group that deposited the genome may have deposited the
  fragments too.
