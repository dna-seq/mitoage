/**
 * Targets for the old site's URLs (www.mitoage.info, 2015), used by the static redirect pages
 * under src/pages/stats-for/, export-section/ and browse/. Build time only.
 */
import { getTaxa } from "~/data";
import type { Region, TaxonNode } from "~/data/schema";
import { taxonUrl } from "~/lib/urls";
import { statsGroupForTaxon } from "./build";
import { LEGACY_REGION_SLUGS, LEGACY_TAXA } from "./legacy";
import { compareGroupUrl, type GroupRank, regionFromSlug, regionSlug, STATS_REGIONS } from "./params";

export interface LegacyTaxon {
  id: number;
  rank: GroupRank;
  node: TaxonNode;
}

/** Old taxon ids that still name a taxon in this build. */
export function legacyTaxa(): LegacyTaxon[] {
  const byKey = new Map(getTaxa().map((t) => [`${t.rank}:${t.name}`, t]));
  return LEGACY_TAXA.flatMap(([rank, id, name]) => {
    const node = byKey.get(`${rank}:${name}`);
    return node ? [{ id, rank, node }] : [];
  });
}

/** Comparative stats page of a taxon, or its taxon page when it has too few species. */
export function taxonStatsUrl(t: LegacyTaxon): string {
  const g = statsGroupForTaxon(t.rank, t.node.name);
  return g ? compareGroupUrl(t.rank, t.node.slug) : taxonUrl(t.rank, t.node.slug);
}

/** Old region slugs ("nd6", "ND6", "d_loop_mtDNA", "rRNA_12S", ...) with their region. */
export function legacyRegions(): { slug: string; region: Region }[] {
  return LEGACY_REGION_SLUGS.flatMap(([slug, r]) => {
    const region = STATS_REGIONS.find((x) => x === r) ?? regionFromSlug(regionSlug(r as Region));
    return region ? [{ slug, region }] : [];
  });
}
