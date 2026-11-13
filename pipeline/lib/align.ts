/** FASTA reading and writing, and the checks and derivations made on a multiple sequence alignment. Pure. */

export interface Seq {
  /** First word of the header line. */
  id: string;
  /** Rest of the header line. */
  desc: string;
  seq: string;
}

export function parseFasta(text: string): Seq[] {
  const out: Seq[] = [];
  let cur: Seq | null = null;
  const parts: string[] = [];
  const flush = () => {
    if (cur) {
      cur.seq = parts.join("");
      out.push(cur);
    }
    parts.length = 0;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(">")) {
      flush();
      const head = line.slice(1).trim();
      const sp = head.search(/\s/);
      cur = { id: sp < 0 ? head : head.slice(0, sp), desc: sp < 0 ? "" : head.slice(sp + 1).trim(), seq: "" };
    } else {
      if (!cur) throw new Error("FASTA: sequence data before the first header");
      parts.push(line);
    }
  }
  flush();
  return out;
}

/** One line per sequence: an alignment's rows then line up in any text viewer. */
export const formatFasta = (seqs: readonly Seq[]): string =>
  seqs.map((s) => `>${s.id}${s.desc ? ` ${s.desc}` : ""}\n${s.seq}\n`).join("");

export const degap = (s: string): string => s.replace(/-/g, "");

/**
 * An alignment must hold exactly the sequences it was given, in their order, unchanged apart from
 * gaps, in rows of one length. Returns that length; throws on the first difference.
 */
export function checkAlignment(input: readonly Seq[], aligned: readonly Seq[]): number {
  if (aligned.length !== input.length) throw new Error(`alignment has ${aligned.length} rows for ${input.length} sequences`);
  const columns = aligned[0]?.seq.length ?? 0;
  if (columns === 0) throw new Error("alignment is empty");
  for (let i = 0; i < input.length; i++) {
    const a = aligned[i]!;
    const s = input[i]!;
    if (a.id !== s.id) throw new Error(`alignment row ${i + 1} is ${a.id}, expected ${s.id}`);
    if (a.seq.length !== columns) throw new Error(`alignment row ${a.id} has ${a.seq.length} columns, the first row ${columns}`);
    if (degap(a.seq).toUpperCase() !== s.seq.toUpperCase()) throw new Error(`alignment row ${a.id} is not its input sequence with gaps`);
  }
  return columns;
}

/**
 * The codon alignment that a protein alignment implies: each residue replaced by its codon, each gap by
 * three gaps. The coding sequence may end in a stop codon, whole or partial, which is left out.
 */
export function threadCodons(alignedProtein: string, cds: string): string {
  const residues = degap(alignedProtein).length;
  if (cds.length < residues * 3) throw new Error(`coding sequence of ${cds.length} nt is too short for ${residues} residues`);
  if (cds.length > residues * 3 + 3) throw new Error(`coding sequence of ${cds.length} nt is too long for ${residues} residues`);
  let out = "";
  let k = 0;
  for (const ch of alignedProtein) {
    if (ch === "-") out += "---";
    else {
      out += cds.slice(k, k + 3);
      k += 3;
    }
  }
  return out;
}

export interface ColumnSummary {
  columns: number;
  /** Columns where at most half of the rows are gaps. */
  occupied: number;
  /** Occupied columns where every non-gap row has one residue. */
  invariant: number;
  /** Occupied columns where one residue is in at least 90 % of the non-gap rows. */
  conserved90: number;
}

export function summariseColumns(aligned: readonly Seq[]): ColumnSummary {
  const n = aligned.length;
  const columns = aligned[0]?.seq.length ?? 0;
  let occupied = 0;
  let invariant = 0;
  let conserved90 = 0;
  for (let i = 0; i < columns; i++) {
    const counts = new Map<string, number>();
    let gaps = 0;
    for (const row of aligned) {
      const ch = row.seq[i]!.toUpperCase();
      if (ch === "-") gaps++;
      else counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    if (gaps * 2 > n) continue;
    occupied++;
    const top = Math.max(...counts.values()) / (n - gaps);
    if (top === 1) invariant++;
    if (top >= 0.9) conserved90++;
  }
  return { columns, occupied, invariant, conserved90 };
}
