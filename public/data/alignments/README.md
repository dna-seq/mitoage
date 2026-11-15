# MitoAge alignments

Multiple sequence alignments of the mitochondrial genes across the 2325 live species of the
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
| ND1.aa.fasta.gz | 2324 | 431 | 324 | 176 | 169 KB |
| ND1.codon.fasta.gz | 2324 | 1293 | 972 | 407 | 555 KB |
| ND2.aa.fasta.gz | 2324 | 737 | 348 | 90 | 297 KB |
| ND2.codon.fasta.gz | 2324 | 2211 | 1044 | 281 | 713 KB |
| COX1.aa.fasta.gz | 2325 | 682 | 515 | 415 | 142 KB |
| COX1.codon.fasta.gz | 2325 | 2046 | 1545 | 878 | 776 KB |
| COX2.aa.fasta.gz | 2325 | 988 | 229 | 119 | 144 KB |
| COX2.codon.fasta.gz | 2325 | 2964 | 687 | 314 | 460 KB |
| ATP8.aa.fasta.gz | 2305 | 296 | 55 | 9 | 98 KB |
| ATP8.codon.fasta.gz | 2305 | 888 | 165 | 37 | 166 KB |
| ATP6.aa.fasta.gz | 2325 | 407 | 227 | 88 | 153 KB |
| ATP6.codon.fasta.gz | 2325 | 1221 | 681 | 240 | 434 KB |
| COX3.aa.fasta.gz | 2325 | 468 | 261 | 167 | 123 KB |
| COX3.codon.fasta.gz | 2325 | 1404 | 783 | 387 | 422 KB |
| ND3.aa.fasta.gz | 2325 | 226 | 116 | 54 | 99 KB |
| ND3.codon.fasta.gz | 2324 | 678 | 348 | 120 | 234 KB |
| ND4L.aa.fasta.gz | 2325 | 199 | 98 | 34 | 89 KB |
| ND4L.codon.fasta.gz | 2324 | 597 | 294 | 90 | 205 KB |
| ND4.aa.fasta.gz | 2325 | 681 | 460 | 188 | 290 KB |
| ND4.codon.fasta.gz | 2325 | 2043 | 1380 | 477 | 837 KB |
| ND5.aa.fasta.gz | 2324 | 1189 | 605 | 235 | 445 KB |
| ND5.codon.fasta.gz | 2324 | 3567 | 1815 | 630 | 1169 KB |
| ND6.aa.fasta.gz | 2323 | 449 | 171 | 29 | 174 KB |
| ND6.codon.fasta.gz | 2323 | 1347 | 513 | 124 | 395 KB |
| CYTB.aa.fasta.gz | 2324 | 548 | 379 | 220 | 188 KB |
| CYTB.codon.fasta.gz | 2324 | 1644 | 1137 | 519 | 614 KB |
| rRNA-12S.nt.fasta.gz | 2323 | 3419 | 934 | 454 | 661 KB |
| rRNA-16S.nt.fasta.gz | 2322 | 6859 | 1543 | 693 | 1260 KB |
