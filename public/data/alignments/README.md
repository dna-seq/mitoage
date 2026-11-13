# MitoAge alignments

Multiple sequence alignments of the mitochondrial genes across the 2316 live species of the
build (retired species are left out). One gzipped FASTA per gene, one line per species; the first word of
each header is the species' slug, as in every other MitoAge table, followed by its name and RefSeq record.

- `GENE.aa.fasta.gz`: the protein, as RefSeq translates it, aligned with MAFFT v7.526
  (`mafft --retree 2 --maxiterate 0 --quiet`, the FFT-NS-2 progressive method).
- `GENE.codon.fasta.gz`: the codon alignment the protein alignment implies (each residue replaced by its
  codon, each gap by three), without the stop codon.
- `rRNA-12S.nt.fasta.gz`, `rRNA-16S.nt.fasta.gz`: the rRNA genes, aligned as nucleotides the same way.
- `alignments.json`: for every file its number of sequences and columns, how many columns are well
  occupied, invariant or carry one residue in 90 % of species, and its SHA-256; the species a gene is not
  annotated in; genes annotated twice (the first copy is used); and the codon rows that do not translate
  exactly to their protein.

Sequences come from NCBI RefSeq mitochondrion release, release 237 (mitochondrion.1.genomic.gbff.gz, file date 2026-09-03). These are sequence alignments made
by one fast method over very distant animals: columns in poorly conserved stretches are not reliable
homology statements. Regenerate with `bun run align`.

| File | Sequences | Columns | Occupied | One residue in 90 % | Size |
| --- | ---: | ---: | ---: | ---: | ---: |
| ND1.aa.fasta.gz | 2315 | 431 | 324 | 176 | 169 KB |
| ND1.codon.fasta.gz | 2315 | 1293 | 972 | 407 | 553 KB |
| ND2.aa.fasta.gz | 2315 | 734 | 348 | 90 | 296 KB |
| ND2.codon.fasta.gz | 2315 | 2202 | 1044 | 281 | 710 KB |
| COX1.aa.fasta.gz | 2316 | 679 | 516 | 415 | 142 KB |
| COX1.codon.fasta.gz | 2316 | 2037 | 1548 | 878 | 773 KB |
| COX2.aa.fasta.gz | 2316 | 988 | 229 | 119 | 144 KB |
| COX2.codon.fasta.gz | 2316 | 2964 | 687 | 314 | 459 KB |
| ATP8.aa.fasta.gz | 2296 | 266 | 55 | 8 | 96 KB |
| ATP8.codon.fasta.gz | 2296 | 798 | 165 | 35 | 162 KB |
| ATP6.aa.fasta.gz | 2316 | 407 | 227 | 88 | 152 KB |
| ATP6.codon.fasta.gz | 2316 | 1221 | 681 | 240 | 433 KB |
| COX3.aa.fasta.gz | 2316 | 468 | 261 | 167 | 123 KB |
| COX3.codon.fasta.gz | 2316 | 1404 | 783 | 387 | 421 KB |
| ND3.aa.fasta.gz | 2316 | 203 | 116 | 54 | 98 KB |
| ND3.codon.fasta.gz | 2315 | 609 | 348 | 120 | 230 KB |
| ND4L.aa.fasta.gz | 2316 | 193 | 98 | 35 | 88 KB |
| ND4L.codon.fasta.gz | 2315 | 579 | 294 | 90 | 204 KB |
| ND4.aa.fasta.gz | 2316 | 671 | 460 | 187 | 288 KB |
| ND4.codon.fasta.gz | 2316 | 2013 | 1380 | 477 | 833 KB |
| ND5.aa.fasta.gz | 2315 | 1193 | 604 | 235 | 444 KB |
| ND5.codon.fasta.gz | 2315 | 3579 | 1812 | 629 | 1167 KB |
| ND6.aa.fasta.gz | 2314 | 484 | 165 | 29 | 178 KB |
| ND6.codon.fasta.gz | 2314 | 1452 | 495 | 127 | 403 KB |
| CYTB.aa.fasta.gz | 2315 | 548 | 379 | 220 | 188 KB |
| CYTB.codon.fasta.gz | 2315 | 1644 | 1137 | 519 | 612 KB |
| rRNA-12S.nt.fasta.gz | 2314 | 3496 | 939 | 452 | 660 KB |
| rRNA-16S.nt.fasta.gz | 2313 | 6888 | 1549 | 691 | 1256 KB |
