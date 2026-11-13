/**
 * /data/explorer.json: compact columnar copy of species, traits and every feature value except
 * per-gene codon and amino-acid features, for the in-browser plot explorer. Built from the committed
 * parquet during the site build (decision D3), not committed.
 */
import type { APIRoute } from "astro";
import { buildExplorer } from "../../../pipeline/steps/explorer";
import { getAllSpecies, getBuildInfo, getFeatureDefs, getFeatureValueArrays } from "~/data";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildExplorer(getAllSpecies(), getFeatureDefs(), getFeatureValueArrays().values, getBuildInfo())), {
    headers: { "Content-Type": "application/json" },
  });
