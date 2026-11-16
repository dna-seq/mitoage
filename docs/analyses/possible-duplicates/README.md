# Possible duplicate species, by sequence

`NEAR_IDENTICAL.tsv` is written by `bun run duplicates` from the committed build and its codon alignments
(`public/data/alignments/`). It lists every pair of species of one genus whose 13 mitochondrial protein genes
agree at 99.9% or more of the bases both have (at least 3,000 shared bases; gaps and N are not counted).

A listed pair is one of three things, and the sequences do not say which: one species under two names, a
record filed under the wrong species, or two real species that share a mitochondrial lineage (recent
divergence or hybridisation; the sturgeons of *Scaphirhynchus* are a published case). Nothing is merged or
flagged in the build from this list.

Not covered: pairs of different genera, and names that a taxonomy treats as synonyms while their sequences
differ. The three pairs flagged by hand in build 2 are of that second kind and are not in this list
(*Panopea generosa* and *P. abrupta* agree at 85.8%, *Euthynnus affinis* and *E. alletteratus* at 94.1%;
*Gadus ogac* is retired and has no alignment).
