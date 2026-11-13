/**
 * EURING longevity list (requested version 2023-09-01). Birds: AnAge > EURING > USGS BBL.
 *
 * The list could not be retrieved when build 2 was assembled (every euring.org URL redirected to a
 * maintenance page on 2026-11-13). Nothing is substituted: the absence is returned as a status that
 * the build records in build-info and in the downloads README, and bird values from USGS BBL are
 * marked provisional because EURING outranks them.
 */
import { existsSync } from "node:fs";
import { EURING, cacheFile } from "./pinned";
import type { SourceObservation } from "./observation";

export type EuringStatus =
  | { retrieved: true; observations: SourceObservation[] }
  | { retrieved: false; observations: []; message: string };

export function loadEuring(): EuringStatus {
  const path = cacheFile(EURING);
  if (!existsSync(path)) {
    return {
      retrieved: false,
      observations: [],
      message: `EURING: not retrieved. The ${EURING.name} (${EURING.version}) is not in the cache (data/cache/${EURING.path}); euring.org was in maintenance on 2026-11-13. No EURING values are used; bird lifespans from USGS BBL are provisional because EURING outranks them.`,
    };
  }
  // The file format was never seen, so no parser is guessed: write one against the real file.
  throw new Error(`EURING list found at data/cache/${EURING.path} but no parser exists for it yet; add one in pipeline/sources/euring.ts`);
}
