/** Download helpers with an on-disk cache under data/cache so reruns work offline. */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const ROOT = join(import.meta.dir, "..", "..");
export const CACHE_DIR = join(ROOT, "data", "cache");

export const USER_AGENT = "mitoage-data-pipeline/1.0 (+https://www.mitoage.info)";

export function cachePath(...parts: string[]): string {
  const p = join(CACHE_DIR, ...parts);
  mkdirSync(dirname(p), { recursive: true });
  return p;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch with retries and exponential backoff. Throws after the last attempt. */
export async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(180_000),
      });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} for ${url}`);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (e) {
      lastError = e;
    }
    await sleep(1000 * 2 ** i);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Return the cached file's bytes, downloading it first when missing. */
export async function cachedDownload(
  relPath: string,
  url: string,
  init: RequestInit = {},
  beforeFetch?: () => Promise<void>,
): Promise<Uint8Array> {
  const path = cachePath(relPath);
  if (existsSync(path)) return new Uint8Array(await Bun.file(path).arrayBuffer());
  await beforeFetch?.();
  console.log(`  downloading ${url}`);
  const res = await fetchWithRetry(url, init);
  const bytes = new Uint8Array(await res.arrayBuffer());
  await Bun.write(path, bytes);
  return bytes;
}

export async function cachedText(
  relPath: string,
  url: string,
  init: RequestInit = {},
  beforeFetch?: () => Promise<void>,
): Promise<string> {
  return new TextDecoder().decode(await cachedDownload(relPath, url, init, beforeFetch));
}

/** Simple rate limiter: at most `perSecond` calls per second. */
export function rateLimiter(perSecond: number): () => Promise<void> {
  const gap = Math.ceil(1000 / perSecond) + 20;
  let last = 0;
  return async () => {
    const wait = last + gap - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
  };
}
