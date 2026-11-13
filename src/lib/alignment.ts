/**
 * An aligned FASTA file of public/data/alignments/, read for the viewer on the gene pages: rows as
 * bytes, per-column statistics over the rows on show, and the residue groups the cells are coloured
 * by. No DOM, safe for islands and for tests.
 */

/** Byte of the gap character. */
export const GAP = 45;

export interface AlignedRow {
  /** Species slug, the first word of the header. */
  slug: string;
  /** Scientific name, the words between the slug and the accession. */
  name: string;
  /** RefSeq accession, the last word of the header. */
  accession: string;
  /** One byte per column: an upper-case letter, or GAP. */
  seq: Uint8Array;
}

export interface Alignment {
  rows: AlignedRow[];
  columns: number;
}

/**
 * Parse an aligned FASTA text whose headers read ">slug Scientific name ACCESSION". Refuses a file
 * with rows of different lengths, or with none: either is not an alignment.
 */
export function parseAlignment(text: string): Alignment {
  const rows: AlignedRow[] = [];
  let header: string | null = null;
  let parts: string[] = [];
  const close = () => {
    if (header === null) return;
    const words = header.trim().split(/\s+/);
    const slug = words[0] ?? "";
    const accession = words.length > 1 ? (words[words.length - 1] ?? "") : "";
    const name = words.slice(1, -1).join(" ");
    const s = parts.join("").toUpperCase();
    const seq = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) seq[i] = s.charCodeAt(i);
    rows.push({ slug, name, accession, seq });
  };
  for (const raw of text.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.startsWith(">")) {
      close();
      header = line.slice(1);
      parts = [];
    } else if (header !== null && line) parts.push(line);
  }
  close();
  if (!rows.length) throw new Error("no sequences in the alignment file");
  const columns = rows[0]!.seq.length;
  for (const r of rows) {
    if (r.seq.length !== columns) {
      throw new Error(`row ${r.slug} has ${r.seq.length} columns, the first row has ${columns}: not an alignment`);
    }
  }
  return { rows, columns };
}

export interface ColumnProfile {
  /** Share of the rows with a residue in the column, 0 to 1. */
  occupancy: Float32Array;
  /** Share of the residues that are the most common one, 0 to 1; 0 where the column has none. */
  conservation: Float32Array;
  /** Byte of the most common residue (ties: the lower byte); 0 where the column has none. */
  consensus: Uint8Array;
}

/** Column statistics over the rows given (the rows on show). */
export function columnProfile(rows: readonly AlignedRow[], columns: number): ColumnProfile {
  const occupancy = new Float32Array(columns);
  const conservation = new Float32Array(columns);
  const consensus = new Uint8Array(columns);
  const counts = new Int32Array(128);
  for (let c = 0; c < columns; c++) {
    counts.fill(0);
    let filled = 0;
    for (const r of rows) {
      const b = r.seq[c]!;
      if (b === GAP) continue;
      counts[b & 127] = counts[b & 127]! + 1;
      filled++;
    }
    if (!filled) continue;
    let top = 0;
    let topByte = 0;
    for (let b = 0; b < 128; b++) {
      if (counts[b]! > top) {
        top = counts[b]!;
        topByte = b;
      }
    }
    occupancy[c] = filled / rows.length;
    conservation[c] = top / filled;
    consensus[c] = topByte;
  }
  return { occupancy, conservation, consensus };
}

/**
 * Indices of the columns to show. With `hideSparse`, a column where more than half of the rows are
 * gaps is left out: the rule the manifest calls "occupied", applied to the rows on show.
 */
export function shownColumns(occupancy: Float32Array, hideSparse: boolean): Int32Array {
  const out: number[] = [];
  for (let c = 0; c < occupancy.length; c++) if (!hideSparse || occupancy[c]! >= 0.5) out.push(c);
  return Int32Array.from(out);
}

// ---------------------------------------------------------------- residue groups

export type AlignmentKind = "protein" | "rRNA";

export interface ResidueGroup {
  key: string;
  label: string;
  /** Letters of the group. */
  letters: string;
  /** CSS colour, a token of tokens.css. */
  color: string;
}

/** Amino acids by side chain. Colours are the tone tokens, so they follow the theme. */
export const PROTEIN_GROUPS: readonly ResidueGroup[] = [
  { key: "hydrophobic", label: "Hydrophobic", letters: "AILMV", color: "var(--tone-green-bar)" },
  { key: "aromatic", label: "Aromatic", letters: "FWY", color: "var(--tone-navy-bar)" },
  { key: "polar", label: "Polar", letters: "STNQ", color: "var(--tone-sky-bar)" },
  { key: "positive", label: "Positive", letters: "KRH", color: "var(--tone-red-bar)" },
  { key: "negative", label: "Negative", letters: "DE", color: "var(--tone-violet-bar)" },
  { key: "cysteine", label: "Cysteine", letters: "C", color: "var(--tone-orange-bar)" },
  { key: "small", label: "Glycine, proline", letters: "GP", color: "var(--nt-other)" },
];

export const NUCLEOTIDE_GROUPS: readonly ResidueGroup[] = [
  { key: "a", label: "A", letters: "A", color: "var(--nt-a)" },
  { key: "c", label: "C", letters: "C", color: "var(--nt-c)" },
  { key: "g", label: "G", letters: "G", color: "var(--nt-g)" },
  { key: "t", label: "T", letters: "TU", color: "var(--nt-t)" },
];

export const groupsOf = (kind: AlignmentKind): readonly ResidueGroup[] =>
  kind === "protein" ? PROTEIN_GROUPS : NUCLEOTIDE_GROUPS;

/**
 * Group index by byte, for drawing: -1 for the gap and for a letter in no group (X, B, an
 * ambiguous base), which is drawn as a letter without a colour.
 */
export function groupIndexByByte(kind: AlignmentKind): Int8Array {
  const out = new Int8Array(128).fill(-1);
  groupsOf(kind).forEach((g, i) => {
    for (const ch of g.letters) out[ch.charCodeAt(0)] = i;
  });
  return out;
}

const AA_NAMES: Record<string, string> = {
  A: "alanine",
  C: "cysteine",
  D: "aspartate",
  E: "glutamate",
  F: "phenylalanine",
  G: "glycine",
  H: "histidine",
  I: "isoleucine",
  K: "lysine",
  L: "leucine",
  M: "methionine",
  N: "asparagine",
  P: "proline",
  Q: "glutamine",
  R: "arginine",
  S: "serine",
  T: "threonine",
  V: "valine",
  W: "tryptophan",
  Y: "tyrosine",
  X: "unknown residue",
  B: "aspartate or asparagine",
  Z: "glutamate or glutamine",
  J: "leucine or isoleucine",
  U: "selenocysteine",
};

/** What a cell holds, in words: "L, leucine", "gap", "G". */
export function residueName(byte: number, kind: AlignmentKind): string {
  if (byte === GAP) return "gap";
  const ch = String.fromCharCode(byte);
  if (kind !== "protein") return ch;
  const name = AA_NAMES[ch];
  return name ? `${ch}, ${name}` : ch;
}

// ---------------------------------------------------------------- loading

/**
 * Text of a fetched file that may be gzipped. A static host serves `.gz` either as the gzip bytes
 * or already decoded (with Content-Encoding), so the first two bytes decide.
 */
export async function maybeGunzipText(buf: ArrayBuffer): Promise<string> {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return new TextDecoder().decode(buf);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

// ---------------------------------------------------------------- species beside the rows

/** What the viewer knows about a species, from /genes/alignment-species.json. */
export interface AlignmentSpeciesPayload {
  classes: string[];
  orders: string[];
  /** In the order of the site's tree: [slug, common name, class index, order index, maximum lifespan in years]. */
  rows: [string, string, number, number, number][];
}
