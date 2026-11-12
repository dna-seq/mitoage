/**
 * Short factual descriptions of the 16 regions with gene pages, and their grouping by
 * respiratory-chain complex. Text only; numbers on the pages always come from the data.
 */
import type { Region } from "~/data/schema";

export type GeneGroupId = "complex-i" | "complex-iii" | "complex-iv" | "complex-v" | "rrna" | "control";

export interface GeneGroup {
  id: GeneGroupId;
  /** Short name, e.g. "Complex I". */
  short: string;
  /** Full name, e.g. "NADH:ubiquinone oxidoreductase". */
  name: string;
  /** One sentence about the group. */
  about: string;
  regions: readonly Region[];
}

export const GENE_GROUPS: readonly GeneGroup[] = [
  {
    id: "complex-i",
    short: "Complex I",
    name: "NADH:ubiquinone oxidoreductase",
    about:
      "The first and largest enzyme of the respiratory chain: it passes electrons from NADH to ubiquinone and pumps protons across the inner mitochondrial membrane. Seven of its core membrane subunits are encoded by mtDNA.",
    regions: ["ND1", "ND2", "ND3", "ND4L", "ND4", "ND5", "ND6"],
  },
  {
    id: "complex-iii",
    short: "Complex III",
    name: "Cytochrome bc1 complex",
    about: "Passes electrons from ubiquinol to cytochrome c while pumping protons. Its one mtDNA-encoded subunit is cytochrome b.",
    regions: ["CYTB"],
  },
  {
    id: "complex-iv",
    short: "Complex IV",
    name: "Cytochrome c oxidase",
    about: "The last enzyme of the respiratory chain, which reduces oxygen to water. Its three catalytic core subunits are encoded by mtDNA.",
    regions: ["COX1", "COX2", "COX3"],
  },
  {
    id: "complex-v",
    short: "Complex V",
    name: "ATP synthase",
    about: "Uses the proton gradient built by complexes I, III and IV to make ATP. Two of its membrane subunits are encoded by mtDNA.",
    regions: ["ATP6", "ATP8"],
  },
  {
    id: "rrna",
    short: "Ribosomal RNA",
    name: "Mitochondrial ribosome",
    about: "The two rRNAs form the core of the mitochondrial ribosome, which translates the 13 mtDNA-encoded proteins.",
    regions: ["rRNA-12S", "rRNA-16S"],
  },
  {
    id: "control",
    short: "Control region",
    name: "Non-coding control region",
    about: "The main non-coding region of the molecule, which regulates replication and transcription.",
    regions: ["D_Loop"],
  },
];

export const groupOf = (region: Region): GeneGroup | undefined => GENE_GROUPS.find((g) => g.regions.includes(region));

/** Two or three factual sentences per region (no claims about lifespan). */
export const GENE_FACTS: Partial<Record<Region, string>> = {
  ND1: "ND1 is a core membrane subunit of Complex I (NADH:ubiquinone oxidoreductase), the first enzyme of the respiratory chain. It sits where the membrane arm meets the peripheral arm and lines part of the cavity in which ubiquinone binds.",
  ND2: "ND2 is a membrane subunit of Complex I (NADH:ubiquinone oxidoreductase). It is one of three subunits, with ND4 and ND5, that resemble bacterial cation/proton antiporters and take part in pumping protons across the inner membrane.",
  ND3: "ND3 is a small membrane subunit of Complex I (NADH:ubiquinone oxidoreductase), close to the junction of the membrane and peripheral arms. A loop of ND3 near the ubiquinone-binding site changes conformation when the enzyme switches between its active and deactive states.",
  ND4L: "ND4L is the smallest Complex I subunit encoded by mtDNA, a membrane protein of about 100 amino acids. In vertebrates the end of its gene overlaps the start of ND4, and the two are translated from one bicistronic transcript.",
  ND4: "ND4 is a membrane subunit of Complex I (NADH:ubiquinone oxidoreductase). With ND2 and ND5 it forms the set of antiporter-like subunits of the membrane arm that take part in pumping protons.",
  ND5: "ND5 is the largest mtDNA-encoded subunit of Complex I and the outermost of the three antiporter-like subunits of the membrane arm. A long helix of ND5 runs along the membrane arm, linking the proton-pumping modules.",
  ND6: "ND6 is a membrane subunit of Complex I (NADH:ubiquinone oxidoreductase). In vertebrates it is the only protein-coding gene on the opposite strand to the other twelve, so its strand-specific base composition (GC and AT skew) differs from theirs.",
  CYTB: "Cytochrome b is the only mtDNA-encoded subunit of Complex III (cytochrome bc1 complex), which passes electrons from ubiquinol to cytochrome c. It carries two haem groups and forms both quinone-binding sites of the complex. Its sequence is widely used in phylogenetics and species identification.",
  COX1: "COX1 is the largest catalytic subunit of cytochrome c oxidase (Complex IV), the enzyme that reduces oxygen to water at the end of the respiratory chain. It holds haem a and the haem a3–CuB centre where oxygen is reduced. A fragment of COX1 is the standard DNA barcode for animals.",
  COX2: "COX2 is a catalytic subunit of cytochrome c oxidase (Complex IV). It binds cytochrome c and carries the CuA centre, which takes electrons from cytochrome c and passes them on to COX1.",
  COX3: "COX3 is a core membrane subunit of cytochrome c oxidase (Complex IV) that carries no metal centres of its own. Together with COX1 and COX2 it forms the catalytic core of the enzyme encoded by mtDNA.",
  ATP6: "ATP6 encodes subunit a of ATP synthase (Complex V). Together with the rotating ring of c subunits it forms the path through which protons cross the membrane and drive ATP synthesis. In vertebrates its gene overlaps the end of ATP8.",
  ATP8: "ATP8 is a small membrane subunit of ATP synthase (Complex V), part of its peripheral stalk. It is the shortest protein encoded by mtDNA, and the gene is missing from the mitochondrial genome of some invertebrates, such as nematodes and many bivalves.",
  "rRNA-12S":
    "The 12S rRNA is the RNA of the small subunit of the mitochondrial ribosome, which decodes the mRNAs of the 13 mtDNA-encoded proteins. In vertebrates its gene lies between the tRNAs for phenylalanine and valine, and its conserved stretches are widely used as markers in phylogenetics and environmental DNA studies.",
  "rRNA-16S":
    "The 16S rRNA is the RNA of the large subunit of the mitochondrial ribosome, which forms the peptide bonds of the 13 mtDNA-encoded proteins. In vertebrates its gene lies between the tRNAs for valine and leucine (UUR), and it is a common marker in barcoding of amphibians and invertebrates.",
  D_Loop:
    "The control region, or D-loop, is the main non-coding region of animal mtDNA. In vertebrates it holds the origin of heavy-strand replication and the promoters that start transcription of both strands, and it often carries a short third strand of DNA (7S DNA) that forms the displacement loop. It evolves faster and varies more in length than the genes.",
};
