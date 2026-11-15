/**
 * Text runs of a simple PDF, with their page, position and font: enough to read a table that a
 * spreadsheet program exported to PDF (the EURING longevity list), and no more.
 *
 * Supported: objects in the open or in object streams (the cross-reference table is not read), FlateDecode or
 * unfiltered content streams, simple fonts with WinAnsiEncoding, text placed with Tm / Td / TD / T*
 * and shown with Tj / TJ. Anything else (another filter, a composite or
 * differently encoded font, the ' and " operators) throws: the reader refuses rather than guess
 * at text it cannot decode.
 */
import { inflateSync } from "node:zlib";

export interface PdfTextRun {
  /** 1-based page number, in page-tree order. */
  page: number;
  x: number;
  y: number;
  /** BaseFont of the run's font, e.g. "Arial-ItalicMT". */
  font: string;
  text: string;
}

type Obj = { body: string; stream: Uint8Array | null };

const latin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");

/** WinAnsiEncoding codes 0x80-0x9f that differ from Latin-1 (PDF 32000-1, annex D). */
const WIN_ANSI_HIGH: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
  0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘",
  0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜",
  0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};
const winAnsi = (codes: number[]) => codes.map((c) => WIN_ANSI_HIGH[c] ?? String.fromCharCode(c)).join("");

function readObjects(bytes: Uint8Array): Map<number, Obj> {
  const s = latin1(bytes);
  const objs = new Map<number, Obj>();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf("endobj", start);
    if (end < 0) throw new Error(`PDF object ${m[1]} has no endobj`);
    let body = s.slice(start, end);
    let stream: Uint8Array | null = null;
    const si = body.search(/\bstream\r?\n/);
    if (si >= 0) {
      const dataStart = start + si + body.slice(si).match(/^stream\r?\n/)![0].length;
      const dataEnd = s.lastIndexOf("endstream", end);
      stream = bytes.subarray(dataStart, dataEnd);
      body = body.slice(0, si);
    }
    objs.set(Number(m[1]), { body, stream });
    re.lastIndex = end;
  }
  // Objects packed in object streams (/Type /ObjStm): "num offset" pairs, then the objects from /First.
  for (const o of [...objs.values()]) {
    if (!o.stream || !/\/Type\s*\/ObjStm\b/.test(o.body)) continue;
    const data = latin1(streamData(o, objs));
    const n = Number(/\/N\s+(\d+)/.exec(o.body)![1]);
    const first = Number(/\/First\s+(\d+)/.exec(o.body)![1]);
    const head = data.slice(0, first).trim().split(/\s+/).map(Number);
    for (let k = 0; k < n; k++) {
      const num = head[2 * k]!;
      const from = first + head[2 * k + 1]!;
      const to = k + 1 < n ? first + head[2 * k + 3]! : data.length;
      if (!objs.has(num)) objs.set(num, { body: data.slice(from, to), stream: null });
    }
  }
  return objs;
}

/** The value of `/Key` in a dictionary body: a reference "N 0 R" -> N, else the raw token text. */
function dictRef(body: string, key: string): number | null {
  const m = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(body);
  return m ? Number(m[1]) : null;
}

function inlineDict(body: string, key: string): string | null {
  const i = body.search(new RegExp(`/${key}\\s*<<`));
  if (i < 0) return null;
  let depth = 0;
  for (let j = body.indexOf("<<", i); j < body.length; j++) {
    if (body.startsWith("<<", j)) { depth++; j++; } else if (body.startsWith(">>", j)) { depth--; j++; if (depth === 0) return body.slice(body.indexOf("<<", i) + 2, j - 1); }
  }
  throw new Error(`unbalanced dictionary /${key}`);
}

function streamData(o: Obj, objs: Map<number, Obj>): Uint8Array {
  if (!o.stream) throw new Error("object has no stream");
  let len: number;
  const lr = dictRef(o.body, "Length");
  if (lr !== null) len = Number(objs.get(lr)!.body.trim());
  else len = Number(/\/Length\s+(\d+)/.exec(o.body)![1]);
  const raw = o.stream.subarray(0, len);
  const filter = /\/Filter\s*\/(\w+)/.exec(o.body)?.[1] ?? null;
  if (/\/Filter\s*\[/.test(o.body)) throw new Error("PDF stream with a filter array is not supported");
  if (filter === null) return raw;
  if (filter === "FlateDecode") return inflateSync(raw);
  throw new Error(`PDF stream filter ${filter} is not supported`);
}

/** Font resource name (F1) -> BaseFont, for a page whose /Resources may be inherited or indirect. */
function pageFonts(page: number, objs: Map<number, Obj>, parentOf: Map<number, number>): Map<string, string> {
  for (let n: number | undefined = page; n !== undefined; n = parentOf.get(n)) {
    const body = objs.get(n)!.body;
    let res = inlineDict(body, "Resources");
    if (res === null) {
      const r = dictRef(body, "Resources");
      if (r !== null) res = objs.get(r)!.body;
    }
    if (res === null) continue;
    let fontDict = inlineDict(res, "Font");
    if (fontDict === null) {
      const r = dictRef(res, "Font");
      if (r !== null) fontDict = objs.get(r)!.body;
    }
    const out = new Map<string, string>();
    for (const fm of (fontDict ?? "").matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) {
      const fb = objs.get(Number(fm[2]))!.body;
      const sub = /\/Subtype\s*\/(\w+)/.exec(fb)?.[1];
      const enc = /\/Encoding\s*\/(\w+)/.exec(fb)?.[1];
      if ((sub !== "TrueType" && sub !== "Type1") || enc !== "WinAnsiEncoding") {
        throw new Error(`PDF font ${fm[1]} (${sub}, ${enc ?? "no encoding"}) is not a WinAnsi simple font`);
      }
      out.set(fm[1]!, /\/BaseFont\s*\/([^\s/<>\[\]]+)/.exec(fb)![1]!);
    }
    return out;
  }
  return new Map();
}

/** Tokens of a content stream: numbers, names, strings (as byte codes), arrays' brackets, operators. */
type Tok = { k: "num"; v: number } | { k: "name"; v: string } | { k: "str"; v: number[] } | { k: "op"; v: string } | { k: "[" } | { k: "]" };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (c === "%") { while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
    if (c === "[" || c === "]") { out.push({ k: c }); i++; continue; }
    if (c === "(") {
      const codes: number[] = [];
      let depth = 1;
      i++;
      while (i < s.length && depth > 0) {
        const d = s[i]!;
        if (d === "\\") {
          const e = s[i + 1]!;
          const simple: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 };
          if (e in simple) { codes.push(simple[e]!); i += 2; }
          else if (/[0-7]/.test(e)) { const o = /^[0-7]{1,3}/.exec(s.slice(i + 1))![0]; codes.push(parseInt(o, 8)); i += 1 + o.length; }
          else if (e === "\r" || e === "\n") { i += s.startsWith("\r\n", i + 1) ? 3 : 2; }
          else { codes.push(e.charCodeAt(0)); i += 2; }
          continue;
        }
        if (d === "(") depth++;
        if (d === ")" && --depth === 0) { i++; break; }
        codes.push(d.charCodeAt(0));
        i++;
      }
      out.push({ k: "str", v: codes });
      continue;
    }
    if (c === "<" && s[i + 1] === "<") { out.push({ k: "op", v: "<<" }); i += 2; continue; }
    if (c === ">" && s[i + 1] === ">") { out.push({ k: "op", v: ">>" }); i += 2; continue; }
    if (c === "<") {
      const j = s.indexOf(">", i);
      const hex = s.slice(i + 1, j).replace(/\s+/g, "");
      const padded = hex.length % 2 ? `${hex}0` : hex;
      out.push({ k: "str", v: Array.from({ length: padded.length / 2 }, (_, n) => parseInt(padded.slice(2 * n, 2 * n + 2), 16)) });
      i = j + 1;
      continue;
    }
    if (c === "/") { const m = /^\/[^\s/<>\[\]()%{}]*/.exec(s.slice(i))![0]; out.push({ k: "name", v: m.slice(1) }); i += m.length; continue; }
    const num = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(s.slice(i, i + 32));
    if (num) { out.push({ k: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const op = /^[^\s/<>\[\]()%{}]+/.exec(s.slice(i, i + 32))![0];
    out.push({ k: "op", v: op });
    i += op.length;
  }
  return out;
}

function runsOfContent(content: string, page: number, fonts: Map<string, string>): PdfTextRun[] {
  const runs: PdfTextRun[] = [];
  const toks = tokenize(content);
  const stack: Tok[] = [];
  let font = "";
  let lineX = 0, lineY = 0, leading = 0;
  const nums = (n: number) => stack.slice(-n).map((t) => (t.k === "num" ? t.v : NaN));
  for (const t of toks) {
    if (t.k !== "op") { stack.push(t); continue; }
    switch (t.v) {
      case "BT": lineX = 0; lineY = 0; break;
      case "Tf": { const nm = stack[stack.length - 2]; if (nm?.k !== "name") throw new Error("Tf without a font name"); font = fonts.get(nm.v) ?? (() => { throw new Error(`unknown font resource ${nm.v} on page ${page}`); })(); break; }
      case "Tm": { const [, , , , e, f] = nums(6); lineX = e!; lineY = f!; break; }
      case "Td": { const [tx, ty] = nums(2); lineX += tx!; lineY += ty!; break; }
      case "TD": { const [tx, ty] = nums(2); leading = -ty!; lineX += tx!; lineY += ty!; break; }
      case "TL": leading = nums(1)[0]!; break;
      case "T*": lineY -= leading; break;
      case "Tj": { const s = stack[stack.length - 1]; if (s?.k !== "str") throw new Error("Tj without a string"); runs.push({ page, x: lineX, y: lineY, font, text: winAnsi(s.v) }); break; }
      case "TJ": {
        const open = stack.map((x) => x.k).lastIndexOf("[");
        const codes = stack.slice(open + 1).flatMap((x) => (x.k === "str" ? x.v : []));
        runs.push({ page, x: lineX, y: lineY, font, text: winAnsi(codes) });
        break;
      }
      case "'": case '"': throw new Error(`text operator ${t.v} is not supported`);
    }
    stack.length = 0;
  }
  return runs;
}

/** Every text run of the document, page by page in page-tree order. */
export function pdfTextRuns(bytes: Uint8Array): PdfTextRun[] {
  const objs = readObjects(bytes);
  const trailer = latin1(bytes).slice(latin1(bytes).lastIndexOf("trailer"));
  const root = dictRef(trailer, "Root");
  if (root === null) throw new Error("PDF trailer has no /Root");
  const pagesRoot = dictRef(objs.get(root)!.body, "Pages")!;
  const pages: number[] = [];
  const parentOf = new Map<number, number>();
  const walk = (n: number) => {
    const body = objs.get(n)!.body;
    if (/\/Type\s*\/Pages\b/.test(body)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(body)![1]!;
      for (const k of kids.matchAll(/(\d+)\s+\d+\s+R/g)) { parentOf.set(Number(k[1]), n); walk(Number(k[1])); }
    } else pages.push(n);
  };
  walk(pagesRoot);
  const runs: PdfTextRun[] = [];
  pages.forEach((p, i) => {
    const body = objs.get(p)!.body;
    const arr = /\/Contents\s*\[([^\]]*)\]/.exec(body);
    const refs = arr ? [...arr[1]!.matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1])) : [dictRef(body, "Contents")!];
    const content = refs.map((r) => latin1(streamData(objs.get(r)!, objs))).join("\n");
    runs.push(...runsOfContent(content, i + 1, pageFonts(p, objs, parentOf)));
  });
  return runs;
}
