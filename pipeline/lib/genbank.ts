/** Parser for GenBank flat files (the subset needed for mitochondrial genomes). */

export interface Segment {
  /** 1-based inclusive. */
  start: number;
  end: number;
  strand: 1 | -1;
}

export interface GbFeature {
  key: string;
  location: string;
  segments: Segment[];
  partial: boolean;
  qualifiers: Record<string, string[]>;
}

export interface GbRecord {
  locus: string;
  accessionVersion: string;
  length: number;
  circular: boolean;
  definition: string;
  organism: string;
  features: GbFeature[];
  sequence: string;
}

/** Parse a location string such as "complement(join(1..10,20..30))" into strand-aware segments. */
export function parseLocation(loc: string): { segments: Segment[]; partial: boolean } {
  const partial = /[<>]/.test(loc);
  const clean = loc.replace(/[<>\s]/g, "");
  const segments: Segment[] = [];
  const walk = (expr: string, strand: 1 | -1): void => {
    const m = /^(complement|join|order)\((.*)\)$/.exec(expr);
    if (m) {
      const op = m[1]!;
      const inner = m[2]!;
      const parts = splitTopLevel(inner);
      if (op === "complement") {
        const before = segments.length;
        for (const p of parts) walk(p, strand === 1 ? -1 : 1);
        // complement(join(a,b)) reads b then a on the minus strand.
        const added = segments.splice(before);
        segments.push(...added.reverse());
      } else {
        for (const p of parts) walk(p, strand);
      }
      return;
    }
    // Remote references (e.g. "J01415.2:1..10") are not supported and skipped.
    if (expr.includes(":")) return;
    const range = /^(\d+)(?:\.\.|\^)(\d+)$/.exec(expr);
    if (range) {
      segments.push({ start: Number(range[1]), end: Number(range[2]), strand });
      return;
    }
    const single = /^(\d+)$/.exec(expr);
    if (single) segments.push({ start: Number(single[1]), end: Number(single[1]), strand });
  };
  walk(clean, 1);
  return { segments, partial };
}

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Split a multi-record GenBank text into individual record texts. */
export function splitRecords(text: string): string[] {
  return text
    .split(/^\/\/\s*$/m)
    .map((r) => r.trim())
    .filter((r) => r.startsWith("LOCUS"))
    .map((r) => r + "\n//\n");
}

export function parseGenBank(text: string): GbRecord {
  const lines = text.split(/\r?\n/);
  const locusLine = lines.find((l) => l.startsWith("LOCUS")) ?? "";
  const locusParts = locusLine.split(/\s+/);
  const locus = locusParts[1] ?? "";
  const lenMatch = /(\d+)\s+bp/.exec(locusLine);
  const length = lenMatch ? Number(lenMatch[1]) : 0;
  const circular = /\bcircular\b/.test(locusLine);

  let definition = "";
  let accessionVersion = "";
  let organism = "";
  const features: GbFeature[] = [];
  let seq = "";

  let i = 0;
  let section = "";
  while (i < lines.length) {
    const line = lines[i]!;
    if (/^[A-Z]/.test(line)) {
      section = line.split(/\s+/)[0]!;
      if (section === "DEFINITION") {
        definition = line.slice(12).trim();
        while (lines[i + 1]?.startsWith("            ")) definition += " " + lines[++i]!.trim();
      } else if (section === "VERSION") {
        accessionVersion = line.slice(12).trim().split(/\s+/)[0] ?? "";
      }
      i++;
      continue;
    }
    if (section === "SOURCE" && line.startsWith("  ORGANISM")) {
      organism = line.slice(12).trim();
    } else if (section === "FEATURES") {
      const fm = /^ {5}(\S+)\s+(\S.*)$/.exec(line);
      if (fm) {
        let location = fm[2]!.trim();
        // Location may continue on following lines (before the first qualifier).
        while (lines[i + 1] && /^ {21}[^/]/.test(lines[i + 1]!)) location += lines[++i]!.trim();
        const qualifiers: Record<string, string[]> = {};
        while (lines[i + 1] && /^ {21}\//.test(lines[i + 1]!)) {
          let q = lines[++i]!.trim().slice(1);
          // Continuation lines of the qualifier value.
          while (lines[i + 1] && /^ {21}[^/]/.test(lines[i + 1]!)) {
            q += " " + lines[++i]!.trim();
          }
          const eq = q.indexOf("=");
          const name = eq === -1 ? q : q.slice(0, eq);
          let value = eq === -1 ? "" : q.slice(eq + 1);
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (name === "translation") value = value.replace(/\s+/g, "");
          (qualifiers[name] ??= []).push(value);
        }
        const { segments, partial } = parseLocation(location);
        features.push({ key: fm[1]!, location, segments, partial, qualifiers });
      }
    } else if (section === "ORIGIN") {
      seq += line.replace(/[^A-Za-z]/g, "");
    }
    i++;
  }
  return {
    locus,
    accessionVersion,
    length,
    circular,
    definition,
    organism,
    features,
    sequence: seq.toUpperCase(),
  };
}

const COMPLEMENT: Record<string, string> = {
  A: "T", T: "A", G: "C", C: "G", R: "Y", Y: "R", K: "M", M: "K", S: "S", W: "W",
  B: "V", V: "B", D: "H", H: "D", N: "N",
};

export function reverseComplement(s: string): string {
  let out = "";
  for (let i = s.length - 1; i >= 0; i--) out += COMPLEMENT[s[i]!] ?? "N";
  return out;
}

/** Extract the sequence of a feature in its own sense (minus-strand segments reverse-complemented). */
export function extractFeature(seq: string, segments: Segment[]): string {
  let out = "";
  for (const s of segments) {
    const piece = seq.slice(s.start - 1, s.end);
    out += s.strand === 1 ? piece : reverseComplement(piece);
  }
  return out;
}
