# Reports on RefSeq records the audit found wrong: drafts

Written by `bun run record-reports` from the list of audited records and the screen against independent
sequences; never edited by hand. **Nothing here was sent.** Sending a report is the maintainer's, under his
name. RefSeq records are NCBI's: a report on one goes to NCBI, and the GenBank record it was made from is
corrected on its submitter's request. Which GenBank record each one was made from was not looked up.

44 audited records: 35 with a draft below, 9 without one (the list at the end, each with the reason).
Identities are over the bases a sequence shares with the record's gene; a sequence that could not be read
against the gene is not counted.

## Drafts

### NC_003162.1, *Saurida undosquamis* (Actinopterygii)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: published as Saurida macrolepis under this name.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Saurida undosquamis (the named species) | 15 of 15 | 86.48 | 92.38 | 77.90 | OQ730381.1 |
| COX1 | Saurida elongata | 15 of 15 | 87.79 | 87.99 | 82.44 | LC636796.1 |
| CYTB | Saurida undosquamis (the named species) | 15 of 15 | 99.66 | 100.00 | 99.44 | OR712973.1 |
| CYTB | Saurida elongata | 5 of 5 | 89.30 | 89.55 | 79.78 | LC636820.1 |

### NC_004744.1, *Lepisosteus oculatus* (Actinopterygii)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 100% and CYTB 99.9% to independent sequences of Lepisosteus platyrhincus; 98.8% and 95.1% to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Lepisosteus oculatus (the named species) | 15 of 15 | 98.83 | 98.83 | 98.54 | KY934172.1 |
| COX1 | Lepisosteus osseus | 15 of 15 | 94.21 | 96.98 | 93.89 | GU144785.1 |
| COX1 | Lepisosteus platyrhincus | 15 of 15 | 100.00 | 100.00 | 99.50 | PQ620107.1 |
| CYTB | Lepisosteus oculatus (the named species) | 15 of 15 | 95.11 | 95.29 | 89.72 | PP331110.1 |
| CYTB | Lepisosteus osseus | 15 of 15 | 90.32 | 90.58 | 89.60 | PP331060.1 |
| CYTB | Lepisosteus platyrhincus | 15 of 15 | 99.91 | 100.00 | 99.64 | PQ653838.1 |

### NC_012706.1, *Bos javanicus* (Mammalia)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: CYTB 100% to independent sequences of Bos taurus; 93.6% (median) to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Bos frontalis | 15 of 15 | 93.80 | 100.00 | 93.67 | PX452215.1 |
| COX1 | Bos grunniens | 15 of 15 | 88.79 | 99.39 | 86.91 | MZ099270.1 |
| COX1 | Bos taurus | 15 of 15 | 98.92 | 100.00 | 98.67 | QB304219.1 |
| CYTB | Bos javanicus (the named species) | 15 of 15 | 93.56 | 99.07 | 92.44 | PV261032.1 |
| CYTB | Bos frontalis | 15 of 15 | 92.61 | 99.91 | 92.20 | EU807953.1 |
| CYTB | Bos grunniens | 13 of 15 | 91.98 | 91.98 | 91.80 | PQ015206.1 |
| CYTB | Bos taurus | 15 of 15 | 100.00 | 100.00 | 98.00 | PQ639891.1 |

### NC_012775.1, *Saimiri sciureus* (Mammalia)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 99.5% and CYTB 99.0% to independent sequences of Saimiri boliviensis; 97.2% and 96.1% to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Saimiri sciureus (the named species) | 12 of 12 | 97.24 | 99.05 | 97.08 | EF658649.1 |
| COX1 | Saimiri boliviensis | 2 of 2 | 99.51 | 99.83 | 99.19 | AY549423.1 |
| CYTB | Saimiri sciureus (the named species) | 15 of 15 | 96.08 | 96.25 | 95.14 | KM234526.1 |
| CYTB | Saimiri boliviensis | 15 of 15 | 99.03 | 99.91 | 98.51 | KM234532.1 |

### NC_022150.1, *Emberiza aureola* (Aves)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification, with sequencing errors.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Emberiza aureola (the named species) | 14 of 14 | 92.94 | 93.33 | 92.46 | GQ481730.1 |
| COX1 | Emberiza schoeniclus | 15 of 15 | 92.65 | 93.20 | 92.33 | GQ481813.1 |
| CYTB | Emberiza aureola (the named species) | 4 of 4 | 94.22 | 94.80 | 94.11 | KP877740.1 |
| CYTB | Emberiza schoeniclus | 15 of 15 | 92.99 | 93.87 | 91.47 | AF053431.1 |

### NC_022452.1, *Anas crecca* (Aves)

- Finding: sequencing errors or nuclear copies are reported for the record, or genes do not translate as annotated.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) for sequencing errors or nuclear copies.
- Asked: that the record is reviewed against the report named here, and a note placed on it or another record chosen as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Anas crecca (the named species) | 15 of 15 | 99.83 | 100.00 | 99.77 | ON387743.1 |
| COX1 | Anas acuta | 15 of 15 | 94.10 | 94.10 | 93.62 | JN703183.1 |
| COX1 | Anas platyrhynchos | 15 of 15 | 93.92 | 94.43 | 93.15 | PX394202.1 |
| CYTB | Anas crecca (the named species) | 15 of 15 | 99.46 | 99.73 | 99.46 | ON412374.1 |
| CYTB | Anas acuta | 3 of 3 | 94.15 | 94.24 | 92.52 | EU914148.1 |
| CYTB | Anas platyrhynchos | 15 of 15 | 94.18 | 94.64 | 94.03 | LC822712.1 |

### NC_022929.1, *Hemiculter leucisculus* (Actinopterygii)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: published: K2P distance 0.0015 to Hemiculter eigenmanni and 0.054 to newly sequenced H. leucisculus.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Hemiculter leucisculus (the named species) | 15 of 15 | 99.04 | 99.26 | 95.09 | PX259644.1 |
| CYTB | Hemiculter leucisculus (the named species) | 15 of 15 | 99.04 | 99.81 | 97.81 | OP420009.1 |

### NC_023969.1, *Aix galericulata* (Aves)

- Finding: the record joins genes of two unrelated species.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a chimera.
- Asked: that the record is reviewed gene by gene, and withdrawn as the species' reference if the mix is confirmed.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Aix galericulata (the named species) | 15 of 15 | 98.13 | 99.68 | 98.13 | AB843340.1 |
| CYTB | Aix galericulata (the named species) | 2 of 2 | 92.98 | 95.10 | 90.85 | EU585604.1 |

### NC_023972.1, *Nemipterus japonicus* (Actinopterygii)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 100% and CYTB 99.5% to independent sequences of Nemipterus virgatus; 86% to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Nemipterus japonicus (the named species) | 15 of 15 | 86.26 | 86.26 | 85.75 | PP818299.1 |
| COX1 | Nemipterus bathybius | 15 of 15 | 89.77 | 90.42 | 89.37 | PV857190.1 |
| COX1 | Nemipterus randalli | 15 of 15 | 89.40 | 89.68 | 89.13 | PQ326130.1 |
| COX1 | Nemipterus virgatus | 15 of 15 | 100.00 | 100.00 | 99.85 | LC952832.1 |
| CYTB | Nemipterus japonicus (the named species) | 15 of 15 | 85.83 | 100.00 | 85.42 | PX767732.1 |
| CYTB | Nemipterus bathybius | 15 of 15 | 86.23 | 86.67 | 86.05 | MN849031.1 |
| CYTB | Nemipterus randalli | 15 of 15 | 86.79 | 88.56 | 86.59 | PX767731.1 |
| CYTB | Nemipterus virgatus | 1 of 1 | 99.50 | 99.50 | 99.50 | AB326977.2 |

### NC_024280.1, *Ceryle rudis* (Aves)

- Finding: the record joins genes of two unrelated species.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a chimera.
- Asked: that the record is reviewed gene by gene, and withdrawn as the species' reference if the mix is confirmed.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| CYTB | Ceryle rudis (the named species) | 1 of 1 | 87.72 | 87.72 | 87.72 | KJ456219.1 |

### NC_024750.1, *Tadorna tadorna* (Aves)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: 99.96% over the 13 protein genes to NC_009684.1 (Anas platyrhynchos) and 90% to Tadorna ferruginea; COX1 99.8% and CYTB 99.9% to independent mallard sequences; the record's paper describes a domestic duck breed; on the list of Sangster & Luksenburg 2021 as mislabelled.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species, a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Tadorna tadorna (the named species) | 9 of 9 | 90.63 | 90.67 | 90.43 | KY754553.1 |
| COX1 | Tadorna ferruginea | 8 of 8 | 89.86 | 89.95 | 89.77 | KP718122.1 |
| CYTB | Tadorna tadorna (the named species) | 1 of 1 | 89.92 | 89.92 | 89.92 | AF059113.1 |
| CYTB | Tadorna ferruginea | 3 of 3 | 89.53 | 91.17 | 87.62 | KC439294.1 |

### NC_024922.1, *Netta rufina* (Aves)

- Finding: the record joins genes of two unrelated species.
- Evidence: COX2 99.6% and COX1 94.4% to Syrmaticus reevesii (a pheasant); the other protein genes 93 to 98% to Aythya; on the list of Sangster & Luksenburg 2021 as a chimera.
- Asked: that the record is reviewed gene by gene, and withdrawn as the species' reference if the mix is confirmed.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Netta rufina (the named species) | 2 of 2 | 93.00 | 93.21 | 92.78 | GU571988.1 |
| CYTB | Netta rufina (the named species) | 2 of 2 | 99.80 | 100.00 | 99.60 | AF173759.1 |

### NC_025576.1, *Coregonus peled* (Actinopterygii)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 99.8% and CYTB 99.5% to independent sequences of Coregonus lavaretus; 98.1% and 96.2% to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Coregonus peled (the named species) | 15 of 15 | 98.12 | 99.85 | 97.73 | KJ128466.1 |
| COX1 | Coregonus artedi | 15 of 15 | 97.74 | 97.90 | 97.60 | MT577066.1 |
| COX1 | Coregonus autumnalis | 15 of 15 | 98.13 | 98.13 | 97.96 | MT577081.1 |
| COX1 | Coregonus clupeaformis | 15 of 15 | 99.36 | 99.40 | 98.81 | OR814556.1 |
| COX1 | Coregonus hoyi | 15 of 15 | 97.71 | 97.86 | 97.71 | KP978280.1 |
| COX1 | Coregonus lavaretus | 15 of 15 | 99.85 | 99.85 | 99.33 | KC009644.1 |
| COX1 | Coregonus muksun | 2 of 2 | 99.80 | 99.85 | 99.76 | MN689111.1 |
| COX1 | Coregonus nasus | 15 of 15 | 98.98 | 99.54 | 98.69 | OQ833603.1 |
| COX1 | Coregonus ussuriensis | 1 of 1 | 98.68 | 98.68 | 98.68 | JX960902.1 |
| CYTB | Coregonus peled (the named species) | 4 of 4 | 96.23 | 97.76 | 95.64 | DQ097737.1 |
| CYTB | Coregonus artedi | 9 of 9 | 95.44 | 96.21 | 95.26 | DQ451312.1 |
| CYTB | Coregonus autumnalis | 7 of 7 | 95.96 | 99.50 | 95.78 | DQ097738.1 |
| CYTB | Coregonus clupeaformis | 15 of 15 | 98.21 | 98.21 | 98.12 | PX624742.1 |
| CYTB | Coregonus hoyi | 2 of 2 | 95.52 | 95.53 | 95.51 | JX960778.1 |
| CYTB | Coregonus lavaretus | 5 of 15 | 99.11 | 99.47 | 99.11 | JN003210.1 |
| CYTB | Coregonus muksun | 4 of 4 | 99.39 | 99.47 | 98.77 | JX960785.1 |
| CYTB | Coregonus nasus | 11 of 11 | 97.98 | 98.06 | 97.89 | JX960786.1 |
| CYTB | Coregonus ussuriensis | 5 of 5 | 98.01 | 98.51 | 97.76 | DQ097735.1 |

### NC_025648.1, *Coregonus ussuriensis* (Actinopterygii)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 99.8% and CYTB 99.5% to independent sequences of Coregonus lavaretus; 98.7% and 98.0% to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Coregonus ussuriensis (the named species) | 1 of 1 | 98.68 | 98.68 | 98.68 | JX960902.1 |
| COX1 | Coregonus artedi | 15 of 15 | 97.74 | 97.90 | 97.60 | MT577066.1 |
| COX1 | Coregonus autumnalis | 15 of 15 | 98.13 | 98.13 | 97.96 | MT577081.1 |
| COX1 | Coregonus clupeaformis | 15 of 15 | 99.36 | 99.40 | 98.81 | OR814556.1 |
| COX1 | Coregonus hoyi | 15 of 15 | 97.71 | 97.86 | 97.71 | KP978280.1 |
| COX1 | Coregonus lavaretus | 15 of 15 | 99.85 | 99.85 | 99.33 | KC009644.1 |
| COX1 | Coregonus muksun | 2 of 2 | 99.80 | 99.85 | 99.76 | MN689111.1 |
| COX1 | Coregonus nasus | 15 of 15 | 98.98 | 99.54 | 98.69 | OQ833603.1 |
| COX1 | Coregonus peled | 15 of 15 | 98.12 | 99.85 | 97.73 | KJ128466.1 |
| CYTB | Coregonus ussuriensis (the named species) | 5 of 5 | 98.01 | 98.51 | 97.76 | DQ097735.1 |
| CYTB | Coregonus artedi | 9 of 9 | 95.44 | 96.21 | 95.26 | DQ451312.1 |
| CYTB | Coregonus autumnalis | 7 of 7 | 95.96 | 99.50 | 95.78 | DQ097738.1 |
| CYTB | Coregonus clupeaformis | 15 of 15 | 98.21 | 98.21 | 98.12 | PX624742.1 |
| CYTB | Coregonus hoyi | 2 of 2 | 95.52 | 95.53 | 95.51 | JX960778.1 |
| CYTB | Coregonus lavaretus | 5 of 15 | 99.11 | 99.47 | 99.11 | JN003210.1 |
| CYTB | Coregonus muksun | 4 of 4 | 99.39 | 99.47 | 98.77 | JX960785.1 |
| CYTB | Coregonus nasus | 11 of 11 | 97.98 | 98.06 | 97.89 | JX960786.1 |
| CYTB | Coregonus peled | 4 of 4 | 96.23 | 97.76 | 95.64 | DQ097737.1 |

### NC_026223.1, *Periparus ater* (Aves)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Periparus ater (the named species) | 15 of 15 | 94.41 | 94.57 | 93.36 | GQ482338.1 |
| CYTB | Periparus ater (the named species) | 15 of 15 | 93.68 | 100.00 | 93.20 | OL906332.1 |

### NC_027277.1, *Coregonus autumnalis* (Actinopterygii)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 and CYTB 100% to independent sequences of Coregonus clupeaformis; 98.1% and 95.9% to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Coregonus autumnalis (the named species) | 15 of 15 | 98.13 | 98.13 | 97.96 | MT577081.1 |
| COX1 | Coregonus artedi | 15 of 15 | 97.74 | 97.90 | 97.60 | MT577066.1 |
| COX1 | Coregonus clupeaformis | 15 of 15 | 100.00 | 100.00 | 99.41 | PZ151440.1 |
| COX1 | Coregonus hoyi | 15 of 15 | 97.71 | 97.86 | 97.71 | KP978280.1 |
| COX1 | Coregonus lavaretus | 15 of 15 | 99.54 | 99.55 | 98.99 | KC009644.1 |
| COX1 | Coregonus muksun | 2 of 2 | 99.33 | 99.54 | 99.13 | MN689111.1 |
| COX1 | Coregonus nasus | 15 of 15 | 98.98 | 99.24 | 98.52 | OQ833603.1 |
| COX1 | Coregonus peled | 15 of 15 | 98.12 | 99.54 | 97.73 | KJ128466.1 |
| COX1 | Coregonus ussuriensis | 1 of 1 | 98.68 | 98.68 | 98.68 | JX960902.1 |
| CYTB | Coregonus autumnalis (the named species) | 7 of 7 | 95.87 | 99.75 | 95.52 | DQ097738.1 |
| CYTB | Coregonus artedi | 9 of 9 | 95.35 | 96.61 | 95.17 | DQ451312.1 |
| CYTB | Coregonus clupeaformis | 15 of 15 | 100.00 | 100.00 | 99.91 | PX624742.1 |
| CYTB | Coregonus hoyi | 2 of 2 | 95.43 | 95.44 | 95.42 | JX960778.1 |
| CYTB | Coregonus lavaretus | 5 of 15 | 97.15 | 97.33 | 96.98 | JN003213.1 |
| CYTB | Coregonus muksun | 4 of 4 | 98.16 | 98.33 | 97.98 | EU003524.1 |
| CYTB | Coregonus nasus | 11 of 11 | 97.45 | 97.46 | 97.27 | KU761851.1 |
| CYTB | Coregonus peled | 4 of 4 | 96.05 | 98.01 | 95.52 | DQ097737.1 |
| CYTB | Coregonus ussuriensis | 5 of 5 | 98.26 | 98.76 | 97.46 | DQ097735.1 |

### NC_028162.1, *Otus scops* (Aves)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Otus scops (the named species) | 9 of 9 | 99.44 | 100.00 | 91.20 | EF515810.1 |
| CYTB | Otus scops (the named species) | 15 of 15 | 93.78 | 93.95 | 92.65 | KR181839.1 |

### NC_028188.1, *Turdus merula* (Aves)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Turdus merula (the named species) | 15 of 15 | 93.14 | 100.00 | 92.90 | MZ049103.1 |
| COX1 | Turdus migratorius | 15 of 15 | 92.94 | 93.40 | 92.60 | KU937174.1 |
| COX1 | Turdus philomelos | 15 of 15 | 89.66 | 89.97 | 89.35 | MK262454.1 |
| CYTB | Turdus merula (the named species) | 15 of 15 | 90.23 | 91.70 | 83.39 | DQ910961.1 |
| CYTB | Turdus migratorius | 15 of 15 | 91.75 | 93.33 | 89.46 | HM217192.1 |
| CYTB | Turdus philomelos | 8 of 8 | 88.09 | 88.50 | 84.36 | DQ910977.1 |

### NC_028346.1, *Spatula clypeata* (Aves)

- Finding: sequencing errors or nuclear copies are reported for the record, or genes do not translate as annotated.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) for sequencing errors or nuclear copies.
- Asked: that the record is reviewed against the report named here, and a note placed on it or another record chosen as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Spatula clypeata (the named species) | 15 of 15 | 99.40 | 99.69 | 99.13 | GU571716.1 |
| CYTB | Spatula clypeata (the named species) | 3 of 3 | 97.31 | 97.31 | 97.20 | EU914154.1 |

### NC_033967.1, *Ninox strenua* (Aves)

- Finding: sequencing errors or nuclear copies are reported for the record, or genes do not translate as annotated.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) for sequencing errors or nuclear copies.
- Asked: that the record is reviewed against the report named here, and a note placed on it or another record chosen as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Ninox novaeseelandiae | 9 of 9 | 90.43 | 90.86 | 89.26 | MK262364.1 |
| CYTB | Ninox strenua (the named species) | 1 of 1 | 98.17 | 98.17 | 98.17 | EU348984.1 |
| CYTB | Ninox novaeseelandiae | 2 of 2 | 91.34 | 91.88 | 90.80 | FJ498980.1 |

### NC_035806.1, *Aquila heliaca* (Aves)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 99.7% and CYTB 99.6% to independent sequences of Aquila chrysaetos; 93.6% and 92.0% to those of its own species; on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species, a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Aquila heliaca (the named species) | 5 of 5 | 93.62 | 93.85 | 93.39 | DQ834323.1 |
| COX1 | Aquila chrysaetos | 9 of 9 | 99.69 | 99.77 | 98.92 | DQ834328.1 |
| COX1 | Aquila fasciata | 1 of 1 | 95.83 | 95.83 | 95.83 | KT803618.1 |
| COX1 | Aquila nipalensis | 3 of 3 | 93.01 | 93.17 | 92.94 | DQ834327.1 |
| CYTB | Aquila heliaca (the named species) | 14 of 15 | 92.02 | 92.44 | 91.30 | EU345506.1 |
| CYTB | Aquila chrysaetos | 9 of 9 | 99.61 | 99.90 | 98.67 | EU345511.1 |
| CYTB | Aquila fasciata | 15 of 15 | 94.51 | 94.72 | 93.40 | EU345491.1 |
| CYTB | Aquila nipalensis | 3 of 12 | 92.88 | 92.95 | 92.66 | EU345507.1 |

### NC_035868.1, *Alcedo atthis* (Aves)

- Finding: the record joins genes of two unrelated species.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a chimera.
- Asked: that the record is reviewed gene by gene, and withdrawn as the species' reference if the mix is confirmed.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Alcedo atthis (the named species) | 15 of 15 | 92.28 | 92.59 | 84.51 | KT803622.1 |
| CYTB | Alcedo atthis (the named species) | 3 of 3 | 99.85 | 100.00 | 79.63 | AF172388.1 |

### NC_035877.1, *Corvus coronoides* (Aves)

- Finding: the record joins genes of two unrelated species.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a chimera.
- Asked: that the record is reviewed gene by gene, and withdrawn as the species' reference if the mix is confirmed.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Corvus coronoides (the named species) | 1 of 1 | 91.29 | 91.29 | 91.29 | JN801437.1 |
| COX1 | Corvus brachyrhynchos | 12 of 12 | 88.91 | 92.70 | 88.29 | AY030179.1 |
| COX1 | Corvus corax | 15 of 15 | 90.36 | 90.78 | 84.33 | OR244265.1 |
| COX1 | Corvus cornix | 5 of 5 | 89.20 | 90.76 | 89.02 | JN801032.1 |
| COX1 | Corvus cryptoleucus | 4 of 4 | 89.85 | 89.97 | 89.53 | AY527235.1 |
| COX1 | Corvus frugilegus | 15 of 15 | 89.89 | 90.05 | 73.32 | OZ363884.1 |
| CYTB | Corvus coronoides (the named species) | 1 of 1 | 94.73 | 94.73 | 94.73 | AF197837.1 |
| CYTB | Corvus brachyrhynchos | 7 of 7 | 89.60 | 92.42 | 84.65 | HM217190.1 |
| CYTB | Corvus corax | 15 of 15 | 89.29 | 89.61 | 76.20 | AY527270.1 |
| CYTB | Corvus cornix | 1 of 1 | 87.85 | 87.85 | 87.85 | HE805701.1 |
| CYTB | Corvus cryptoleucus | 8 of 8 | 90.23 | 90.88 | 88.64 | AY005978.1 |
| CYTB | Corvus hawaiiensis | 1 of 1 | 90.88 | 90.88 | 90.88 | AY005928.1 |

### NC_037970.1, *Raja asterias* (Chondrichthyes)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 98.8% and CYTB 99.1% to independent sequences of Raja clavata; 93.6% and 93.2% to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Raja asterias (the named species) | 15 of 15 | 93.57 | 94.11 | 93.39 | MW300451.1 |
| COX1 | Raja brachyura | 15 of 15 | 94.75 | 94.92 | 94.53 | PV524841.1 |
| COX1 | Raja clavata | 15 of 15 | 98.83 | 98.89 | 97.72 | PZ676110.1 |
| COX1 | Raja miraletus | 15 of 15 | 92.52 | 92.52 | 91.13 | PV524868.1 |
| COX1 | Raja polystigma | 15 of 15 | 95.94 | 95.94 | 95.76 | PV524891.1 |
| COX1 | Raja undulata | 15 of 15 | 93.87 | 95.12 | 92.55 | KT307416.1 |
| CYTB | Raja asterias (the named species) | 1 of 1 | 93.18 | 93.18 | 93.18 | MF100945.1 |
| CYTB | Raja brachyura | 6 of 6 | 93.58 | 93.95 | 93.33 | GQ392120.1 |
| CYTB | Raja clavata | 14 of 14 | 99.11 | 99.22 | 98.31 | AY859719.1 |
| CYTB | Raja miraletus | 1 of 1 | 94.52 | 94.52 | 94.52 | MF100947.1 |
| CYTB | Raja polystigma | 1 of 1 | 98.82 | 98.82 | 98.82 | MF100948.1 |
| CYTB | Raja undulata | 1 of 1 | 93.22 | 93.22 | 93.22 | GQ392118.1 |

### NC_041251.1, *Hydrobates castro* (Aves)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Hydrobates castro (the named species) | 5 of 5 | 95.65 | 95.94 | 95.51 | AY666400.1 |
| CYTB | Hydrobates castro (the named species) | 8 of 8 | 95.25 | 95.49 | 94.03 | KU217335.1 |

### NC_041578.1, *Rallus aquaticus* (Aves)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) as a misidentification.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Rallus aquaticus (the named species) | 15 of 15 | 97.38 | 100.00 | 96.45 | GQ482593.1 |
| CYTB | Rallus aquaticus (the named species) | 4 of 4 | 97.51 | 99.79 | 95.12 | JQ342146.1 |

### NC_044648.1, *Tringa totanus* (Aves)

- Finding: sequencing errors or nuclear copies are reported for the record, or genes do not translate as annotated.
- Evidence: on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 (Genome Biol Evol 13:evab210) for sequencing errors or nuclear copies.
- Asked: that the record is reviewed against the report named here, and a note placed on it or another record chosen as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Tringa totanus (the named species) | 15 of 15 | 99.14 | 100.00 | 98.13 | GQ482796.1 |
| COX1 | Tringa brevipes | 6 of 6 | 89.54 | 89.91 | 89.35 | GQ482778.1 |
| COX1 | Tringa erythropus | 10 of 10 | 90.20 | 90.97 | 88.54 | GU572131.1 |
| COX1 | Tringa glareola | 15 of 15 | 92.50 | 93.61 | 92.02 | EU525559.1 |
| COX1 | Tringa incana | 3 of 3 | 88.89 | 89.67 | 88.80 | EU525563.1 |
| COX1 | Tringa melanoleuca | 15 of 15 | 89.50 | 90.22 | 88.59 | EU525566.1 |
| COX1 | Tringa nebularia | 15 of 15 | 89.42 | 90.77 | 88.98 | EU525573.1 |
| COX1 | Tringa ochropus | 11 of 11 | 88.33 | 89.73 | 88.18 | KF147203.1 |
| COX1 | Tringa semipalmata | 14 of 14 | 90.21 | 90.87 | 89.44 | EU525574.1 |
| COX1 | Tringa stagnatilis | 6 of 6 | 93.19 | 94.06 | 93.08 | KF147204.1 |
| CYTB | Tringa totanus (the named species) | 2 of 2 | 99.01 | 99.77 | 98.25 | AY894237.1 |
| CYTB | Tringa brevipes | 1 of 1 | 90.23 | 90.23 | 90.23 | AY894225.1 |
| CYTB | Tringa erythropus | 1 of 1 | 90.80 | 90.80 | 90.80 | AY894226.1 |
| CYTB | Tringa glareola | 2 of 2 | 92.23 | 92.87 | 91.58 | AY894228.1 |
| CYTB | Tringa incana | 1 of 1 | 89.08 | 89.08 | 89.08 | AY894230.1 |
| CYTB | Tringa melanoleuca | 2 of 2 | 88.92 | 90.23 | 87.61 | AY894232.1 |
| CYTB | Tringa nebularia | 2 of 2 | 87.35 | 89.77 | 84.94 | AY894233.1 |
| CYTB | Tringa ochropus | 1 of 1 | 89.40 | 89.40 | 89.40 | AY894234.1 |
| CYTB | Tringa semipalmata | 1 of 1 | 91.49 | 91.49 | 91.49 | AY894224.1 |
| CYTB | Tringa stagnatilis | 1 of 1 | 92.99 | 92.99 | 92.99 | AY894236.1 |

### NC_045368.1, *Agapornis pullarius* (Aves)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: 89% to independent sequences of Agapornis pullarius; no difference in 11,280 bases from NC_045369.1 (Agapornis lilianae); on the list of problematic bird mitogenomes of Sangster & Luksenburg 2021 as mislabelled.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species, a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Agapornis pullarius (the named species) | 1 of 1 | 89.06 | 89.06 | 89.06 | OQ272221.1 |
| CYTB | Agapornis pullarius (the named species) | 6 of 6 | 88.25 | 88.73 | 88.02 | AF001326.1 |
| CYTB | Agapornis lilianae | 1 of 1 | 98.23 | 98.23 | 98.23 | AF001331.1 |

### NC_046016.1, *Rhizoprionodon acutus* (Chondrichthyes)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: published as a misidentified Scoliodon macrorhynchos.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: a published report.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Rhizoprionodon acutus (the named species) | 15 of 15 | 88.38 | 89.49 | 87.77 | PP463756.1 |
| CYTB | Rhizoprionodon acutus (the named species) | 1 of 1 | 84.44 | 84.44 | 84.44 | MG811806.1 |

### NC_060591.1, *Echis carinatus* (Reptilia)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 99.4% and CYTB 99.6% to independent sequences of Vipera berus, 84% and 81% to those of Echis carinatus; 99.97% over the 13 protein genes to NC_036956.1 (Vipera berus).
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Echis carinatus (the named species) | 8 of 9 | 84.29 | 84.74 | 83.63 | MG699965.1 |
| COX1 | Echis coloratus | 10 of 10 | 83.05 | 83.05 | 82.14 | PV255555.1 |
| CYTB | Echis carinatus (the named species) | 15 of 15 | 81.43 | 83.10 | 80.97 | OP739086.1 |
| CYTB | Echis coloratus | 11 of 11 | 83.76 | 84.26 | 81.67 | GQ359462.1 |

### NC_060592.1, *Echis coloratus* (Reptilia)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 99.4% and CYTB 99.6% to independent sequences of Vipera berus, 83% to those of Echis coloratus; identical over the 13 protein genes to NC_036956.1 (Vipera berus).
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Echis coloratus (the named species) | 10 of 10 | 83.05 | 83.05 | 82.14 | PV255555.1 |
| COX1 | Echis carinatus | 8 of 9 | 84.29 | 84.74 | 83.63 | MG699965.1 |
| CYTB | Echis coloratus (the named species) | 11 of 11 | 83.76 | 84.26 | 81.67 | GQ359462.1 |
| CYTB | Echis carinatus | 15 of 15 | 81.43 | 83.10 | 80.97 | OP739086.1 |

### NC_064163.1, *Aotus vociferans* (Mammalia)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 99.5% and CYTB 99.6% to independent sequences of Aotus trivirgatus; 94.2% and 93.6% to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Aotus vociferans (the named species) | 4 of 4 | 94.21 | 94.28 | 94.08 | MT492189.1 |
| COX1 | Aotus azarai | 15 of 15 | 94.28 | 94.59 | 94.13 | MT492184.1 |
| COX1 | Aotus lemurinus | 9 of 9 | 94.77 | 94.95 | 94.13 | PX418560.1 |
| COX1 | Aotus trivirgatus | 5 of 5 | 99.49 | 100.00 | 86.48 | HQ005480.1 |
| CYTB | Aotus vociferans (the named species) | 9 of 9 | 93.58 | 100.00 | 93.32 | MW736163.1 |
| CYTB | Aotus azarai | 15 of 15 | 93.14 | 93.66 | 92.61 | MT488660.1 |
| CYTB | Aotus lemurinus | 5 of 5 | 93.89 | 94.12 | 93.23 | MT232916.1 |
| CYTB | Aotus trivirgatus | 4 of 4 | 99.74 | 100.00 | 98.77 | MT488674.1 |

### NC_066918.1, *Pomoxis annularis* (Actinopterygii)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 100% and CYTB 99.7% to independent sequences of Pomoxis nigromaculatus; 87.9% and 91.8% to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Pomoxis annularis (the named species) | 15 of 15 | 88.33 | 88.38 | 88.02 | KX145568.1 |
| COX1 | Pomoxis nigromaculatus | 15 of 15 | 100.00 | 100.00 | 96.42 | OR081631.1 |
| CYTB | Pomoxis annularis (the named species) | 5 of 5 | 91.82 | 97.46 | 89.65 | AY115990.1 |
| CYTB | Pomoxis nigromaculatus | 8 of 8 | 99.75 | 100.00 | 98.42 | JN008741.1 |

### NC_069041.1, *Solenocera melantho* (Malacostraca)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 100% to four independent sequences of Solenocera crassicornis; 85% and 82% (COX1, CYTB) to those of its own species.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Solenocera melantho (the named species) | 7 of 7 | 84.77 | 87.94 | 81.75 | OQ980354.1 |
| COX1 | Solenocera crassicornis | 10 of 15 | 96.41 | 100.00 | 72.36 | PZ169459.1 |
| CYTB | Solenocera melantho (the named species) | 3 of 3 | 84.28 | 84.72 | 84.18 | GU951443.1 |
| CYTB | Solenocera crassicornis | 5 of 5 | 94.85 | 94.93 | 69.83 | KX584722.1 |

### NC_072260.1, *Negaprion brevirostris* (Chondrichthyes)

- Finding: the record's protein genes are another species' than the one it is named for.
- Evidence: COX1 99.8% and CYTB 99.9% to independent sequences of Carcharhinus acronotus, 93.3% and 90.7% to those of Negaprion brevirostris.
- Asked: that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference.
- Rests on: independent sequences of the named species.

COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):

| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |
|---|---|---|---|---|---|---|
| COX1 | Negaprion brevirostris (the named species) | 13 of 13 | 93.25 | 93.45 | 93.18 | FJ519231.1 |
| CYTB | Negaprion brevirostris (the named species) | 1 of 1 | 90.73 | 90.73 | 90.73 | L08039.1 |

## Not drafted

| record | species | finding | why no draft |
|---|---|---|---|
| NC_001947.1 | Pelomedusa subrufa | sequence_errors | the evidence is the record itself or other RefSeq records: no independent sequence and no published list |
| NC_006516.1 | Metachirus nudicaudatus | other_species | the evidence is the record itself or other RefSeq records: no independent sequence and no published list |
| NC_009729.1 | Paleosuchus palpebrosus | truncated | the finding is read from the record itself; not in the first group of reports |
| NC_020020.1 | Homarus gammarus | truncated | the finding is read from the record itself; not in the first group of reports |
| NC_020656.1 | Ovis ammon | specimen_doubt | the finding is read from the record itself; not in the first group of reports |
| NC_025665.1 | Seriolella porosa | chimera | the evidence is the record itself or other RefSeq records: no independent sequence and no published list |
| NC_030323.1 | Netuma thalassina | one_genome_names | which of the names is right is not settled |
| NC_045222.1 | Arius maculatus | one_genome_names | which of the names is right is not settled |
| NC_061386.1 | Bagrus docmak | truncated | the finding is read from the record itself; not in the first group of reports |
