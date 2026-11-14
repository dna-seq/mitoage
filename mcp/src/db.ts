/**
 * Finding the database and opening it read-only.
 *
 * Two ways in, and no third: `MITOAGE_DB`, a database already on disk, or the pinned revision of
 * the Hugging Face dataset, downloaded once into the cache and checked against its digest. A
 * missing pin, a download that fails and a digest that does not match all stop the server with the
 * reason. Nothing here falls back to "the newest file": the answers would change under the person
 * asking, and a database that is cited cannot do that.
 */
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { once } from "node:events";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATASET, downloadUrl, type DatasetPin } from "./dataset.js";

/** Where a downloaded database is kept: one folder per revision, so two pins never collide. */
export function cacheDir(pin: DatasetPin, revision: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = env["XDG_CACHE_HOME"] ?? join(env["HOME"] ?? homedir(), ".cache");
  return join(base, "mitoage-mcp", revision, pin.repo.replace("/", "_"));
}

export interface Resolved {
  path: string;
  /** How it was found, for the server's first line and for `build_info`'s answer. */
  source: "MITOAGE_DB" | "cache" | "download";
  revision: string | null;
}

/** The database file, downloading it once if the pin names a revision and the cache has no copy. */
export async function resolveDatabase(pin: DatasetPin = DATASET, env: NodeJS.ProcessEnv = process.env): Promise<Resolved> {
  const override = env["MITOAGE_DB"];
  if (override !== undefined && override !== "") {
    if (!existsSync(override)) throw new Error(`MITOAGE_DB is ${override}, and there is no file there`);
    return { path: override, source: "MITOAGE_DB", revision: null };
  }
  const revision = env["MITOAGE_REVISION"] ?? pin.revision;
  if (revision === null || revision === undefined || revision === "") {
    throw new Error(
      `this build of ${pin.repo} is not pinned to a dataset revision yet, so there is nothing to download. ` +
        `Point MITOAGE_DB at a mitoage.sqlite file, or set MITOAGE_REVISION to the commit of ` +
        `https://huggingface.co/datasets/${pin.repo} that holds ${pin.file}.`,
    );
  }
  const dir = cacheDir(pin, revision, env);
  const path = join(dir, pin.file);
  if (existsSync(path)) return { path, source: "cache", revision };
  mkdirSync(dir, { recursive: true });
  const url = downloadUrl(pin, revision);
  const partial = `${path}.partial`;
  rmSync(partial, { force: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`downloading ${url}: the server answered ${response.status} ${response.statusText}`);
  if (response.body === null) throw new Error(`downloading ${url}: the answer carried no body`);
  // The web stream is read directly rather than adapted to a Node stream: the two ReadableStream
  // types do not line up across the runtimes this file is checked under.
  const digest = createHash("sha256");
  const file = createWriteStream(partial);
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      digest.update(value);
      if (!file.write(value)) await once(file, "drain");
    }
  } finally {
    file.end();
  }
  await once(file, "finish");
  const got = digest.digest("hex");
  if (pin.sha256 !== null && got !== pin.sha256) {
    rmSync(partial, { force: true });
    throw new Error(`downloading ${url}: the file hashes to ${got}, the pin says ${pin.sha256}`);
  }
  renameSync(partial, path);
  return { path, source: "download", revision };
}

export interface Opened {
  db: DatabaseSync;
  path: string;
  source: Resolved["source"];
  revision: string | null;
  bytes: number;
}

/** Open the resolved database read-only. The server never writes to it. */
export async function openDatabase(pin: DatasetPin = DATASET, env: NodeJS.ProcessEnv = process.env): Promise<Opened> {
  const found = await resolveDatabase(pin, env);
  const db = new DatabaseSync(found.path, { readOnly: true });
  return { db, path: found.path, source: found.source, revision: found.revision, bytes: statSync(found.path).size };
}
