/**
 * Pinned upstream inputs of build 2. Each lives in the download cache (data/cache, not in git)
 * at a fixed path. A pinned input is never silently replaced: if the file is missing the build
 * stops (requirePinned), except EURING, whose absence is recorded loudly (sources/euring.ts).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR } from "../lib/cache";

export interface PinnedSource {
  name: string;
  version: string;
  /** Path relative to data/cache. */
  path: string;
  url: string;
  license: string;
  retrieved: string;
  md5?: string;
}

export const BUILD2_DOWNLOAD_DATE = "2026-11-13";

export const REFSEQ_RELEASE: PinnedSource = {
  name: "NCBI RefSeq mitochondrion release",
  version: "release 237 (mitochondrion.1.genomic.gbff.gz, file date 2026-09-03)",
  path: "build2/sources/refseq_mitochondrion/release237/mitochondrion.1.genomic.gbff.gz",
  url: "https://ftp.ncbi.nlm.nih.gov/refseq/release/mitochondrion/",
  license: "NCBI molecular data are free of use restrictions (NCBI website and data usage policies)",
  retrieved: BUILD2_DOWNLOAD_DATE,
  md5: "4491799651740f49c8f6a011cf9a96e5",
};

export const NCBI_TAXONOMY: PinnedSource = {
  name: "NCBI Taxonomy (new_taxdump)",
  version: "new_taxdump of 2026-11-13 (Last-Modified 2026-11-13T00:42:20Z)",
  path: "build2/sources/ncbi_taxonomy/2026-11-13",
  url: "https://ftp.ncbi.nlm.nih.gov/pub/taxonomy/new_taxdump/",
  license: "NCBI Taxonomy is free of use restrictions (NCBI website and data usage policies); cite Schoch et al. 2020, Database baaa062",
  retrieved: BUILD2_DOWNLOAD_DATE,
};

export const ANAGE_PINNED: PinnedSource = {
  name: "AnAge",
  version: "AnAge build 15 (2023-07-03)",
  path: "anage/dataset.zip",
  url: "https://genomics.senescence.info/species/dataset.zip",
  license:
    "Free to use, subject to the Human Ageing Genomic Resources conditions of use (https://genomics.senescence.info/legal.html); cite Tacutu et al. 2013, Nucleic Acids Res 41:D1027-D1033",
  retrieved: BUILD2_DOWNLOAD_DATE,
  md5: "7ec4d19f6c8f57b22595a9ffd50ea66b",
};

export const FISHBASE: PinnedSource = {
  name: "FishBase",
  version: "FishBase v26.06 (source.coop cboettig/fishbase, files 2026-09-04)",
  path: "build2/sources/fishbase/v26.06",
  url: "https://source.coop/cboettig/fishbase (fb/v26.06/parquet)",
  license: "CC BY-NC 4.0 (FishBase.org team; source.coop cboettig/fishbase dataset card): non-commercial use only; cite Froese & Pauly, FishBase",
  retrieved: BUILD2_DOWNLOAD_DATE,
};

export const SEALIFEBASE: PinnedSource = {
  name: "SeaLifeBase",
  version: "SeaLifeBase v26.06 (source.coop cboettig/fishbase, files 2026-09-04)",
  path: "build2/sources/sealifebase/v26.06",
  url: "https://source.coop/cboettig/fishbase (slb/v26.06/parquet)",
  license: "CC BY-NC 4.0 (SeaLifeBase/FishBase.org team; source.coop cboettig/fishbase dataset card): non-commercial use only; cite Palomares & Pauly, SeaLifeBase",
  retrieved: BUILD2_DOWNLOAD_DATE,
};

export const USGS_BBL: PinnedSource = {
  name: "USGS Bird Banding Laboratory longevity records",
  version: "NABBP Longevity Records v2025.1 (current through Dec 2025)",
  path: "build2/sources/usgs_bbl/version2025/usgs_bbl_longevity_2025.csv",
  url: "https://www.pwrc.usgs.gov/BBL/Bander_Portal/login/Longevity.php",
  license:
    "U.S. Government work (USGS), presumed public domain; cite Bird Banding Laboratory, NABBP Longevity Records v2025.1, USGS EESC, Laurel MD (usgs.gov terms page returned HTTP 403, not verified)",
  retrieved: BUILD2_DOWNLOAD_DATE,
};

export const EURING: PinnedSource = {
  name: "EURING longevity list",
  version: "list of 2023-09-01",
  path: "build2/sources/euring/2023-09-01/euring_longevity_2023-09-01.csv",
  url: "https://euring.org/data-and-codes/longevity-list",
  license: "not checked (site unavailable when build 2 was assembled)",
  retrieved: BUILD2_DOWNLOAD_DATE,
};

export const cacheFile = (p: PinnedSource, ...rest: string[]) => join(CACHE_DIR, p.path, ...rest);

/** Absolute path of a pinned input; throws when it is not in the cache (no silent substitute). */
export function requirePinned(p: PinnedSource, ...rest: string[]): string {
  const path = cacheFile(p, ...rest);
  if (!existsSync(path)) {
    throw new Error(
      `Pinned input missing: ${p.name} ${p.version} at data/cache/${join(p.path, ...rest)}. Build 2 is pinned to this file; restore it (${p.url}) rather than using another version.`,
    );
  }
  return path;
}
