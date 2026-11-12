/**
 * Per-gene codon and amino-acid frequencies for the plot explorer:
 * /explore/values/{gene}-codon.json (64 features) and /explore/values/{gene}-aa.json (20 features)
 * for the 13 protein-coding genes. Everything else the explorer plots is in /data/explorer.json.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import { buildChunk, chunkSpecs, type ChunkSpec } from "~/lib/explore/build";

export const getStaticPaths = (() =>
  chunkSpecs().map((spec) => ({ params: { chunk: spec.name }, props: { spec } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(buildChunk((props as { spec: ChunkSpec }).spec)), {
    headers: { "Content-Type": "application/json" },
  });
