/**
 * Parquet reading and writing shared by the pipeline and the site's data layer.
 *
 * Reading uses hyparquet with Bun's built-in zstd for ZSTD pages (the FishBase/SeaLifeBase
 * snapshots are ZSTD-compressed); writing uses hyparquet-writer.
 */
import { parquetReadObjects } from "hyparquet";
import { parquetWriteBuffer } from "hyparquet-writer";

const compressors = {
  ZSTD: (input: Uint8Array) => new Uint8Array(Bun.zstdDecompressSync(input)),
};

export type Row = Record<string, unknown>;

/** Read a parquet file (or buffer) into row objects; `columns` limits what is decoded. */
export async function readParquet(source: string | ArrayBuffer, columns?: string[]): Promise<Row[]> {
  const file = typeof source === "string" ? await Bun.file(source).arrayBuffer() : source;
  const rows = (await parquetReadObjects({ file, compressors, ...(columns ? { columns } : {}) })) as Row[];
  // hyparquet returns INT64 as BigInt; the data here never exceeds 2^53.
  for (const r of rows) for (const k in r) if (typeof r[k] === "bigint") r[k] = Number(r[k]);
  return rows;
}

export type ColType = "INT32" | "DOUBLE" | "STRING" | "BOOLEAN";
export interface Column {
  name: string;
  type: ColType;
  data: unknown[];
}

/** Encode columns as a parquet buffer. INT32 columns are checked, never silently truncated. */
export function parquetBuffer(cols: Column[]): ArrayBuffer {
  for (const c of cols) {
    if (c.data.length !== cols[0]!.data.length) throw new Error(`parquet column ${c.name}: length ${c.data.length} != ${cols[0]!.data.length}`);
    if (c.type === "INT32") {
      for (const v of c.data) {
        if (v !== null && v !== undefined && !(Number.isInteger(v) && Math.abs(v as number) < 2 ** 31)) {
          throw new Error(`parquet column ${c.name}: ${String(v)} is not an INT32`);
        }
      }
    }
  }
  return parquetWriteBuffer({
    columnData: cols.map((c) => ({ name: c.name, type: c.type, data: c.data.map((v) => (v === undefined ? null : v)) as never })),
  });
}

export async function writeParquet(path: string, cols: Column[]): Promise<number> {
  const buf = parquetBuffer(cols);
  await Bun.write(path, buf);
  return buf.byteLength;
}

/** Stream a text file line by line without holding it in memory. */
export async function forEachLine(path: string, onLine: (line: string) => void): Promise<void> {
  const dec = new TextDecoder();
  let rest = "";
  for await (const chunk of Bun.file(path).stream()) {
    const text = rest + dec.decode(chunk, { stream: true });
    let start = 0;
    let nl: number;
    while ((nl = text.indexOf("\n", start)) >= 0) {
      onLine(text.slice(start, nl));
      start = nl + 1;
    }
    rest = text.slice(start);
  }
  rest += dec.decode();
  if (rest) onLine(rest);
}

/** MD5 of a file, streamed. */
export async function md5File(path: string): Promise<string> {
  const h = new Bun.CryptoHasher("md5");
  for await (const chunk of Bun.file(path).stream()) h.update(chunk);
  return h.digest("hex");
}
