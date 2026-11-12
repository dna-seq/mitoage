/** NCBI E-utilities efetch of GenBank records, cached per accession under data/cache/genbank. */
import { existsSync } from "node:fs";
import { cachePath, fetchWithRetry, rateLimiter } from "../lib/cache";
import { splitRecords } from "../lib/genbank";

const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const TOOL = "mitoage-data-pipeline";
const BATCH = 100;

const gbPath = (acc: string) => cachePath("genbank", `${acc}.gb`);

/**
 * Ensure every accession (with version) is cached. Returns accession -> GenBank text
 * for the ones available; failures are reported in `failed`.
 */
export async function fetchGenBank(accessions: string[]): Promise<{ texts: Map<string, string>; failed: string[] }> {
  const texts = new Map<string, string>();
  const missing = accessions.filter((a) => !existsSync(gbPath(a)));
  if (missing.length) {
    console.log(`  NCBI efetch: ${missing.length} of ${accessions.length} records not cached, fetching in batches of ${BATCH}`);
  }
  const limit = rateLimiter(2.5);
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    await limit();
    const body = new URLSearchParams({
      db: "nuccore",
      rettype: "gbwithparts",
      retmode: "text",
      tool: TOOL,
      id: batch.join(","),
    });
    try {
      const res = await fetchWithRetry(EFETCH, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const text = await res.text();
      const records = splitRecords(text);
      for (const rec of records) {
        const ver = /^VERSION\s+(\S+)/m.exec(rec)?.[1];
        if (ver && batch.includes(ver)) await Bun.write(gbPath(ver), rec);
      }
      console.log(`    batch ${i / BATCH + 1}/${Math.ceil(missing.length / BATCH)}: ${records.length} records`);
    } catch (e) {
      console.warn(`    batch ${i / BATCH + 1} failed: ${(e as Error).message}`);
    }
  }
  const failed: string[] = [];
  for (const acc of accessions) {
    const p = gbPath(acc);
    if (existsSync(p)) texts.set(acc, await Bun.file(p).text());
    else failed.push(acc);
  }
  return { texts, failed };
}
