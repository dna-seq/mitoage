#!/usr/bin/env node
/**
 * mitoage-mcp: the MitoAge build as MCP tools, over stdio.
 *
 * Experimental. The tables and the alignments at https://huggingface.co/datasets/longevity-genie/mitoage
 * and under https://www.mitoage.info/data/ are the access route to cite; this server is a second one,
 * for an agent that would otherwise download a table and correlate two columns itself. That is the
 * mistake the MitoAge 2 analysis is about: across the mtDNA features, most raw correlations with
 * lifespan do not survive the false discovery rate, phylogenetically independent contrasts or a
 * control for body mass. So no tool here returns a raw r alone. Every correlation comes with its
 * q-value, both controls, the filters of the dataset it was computed on, and the build it is from.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { DatabaseSync } from "node:sqlite";
import { DATASET } from "./dataset.js";
import { openDatabase } from "./db.js";
import { buildFacts, correlation, RANKS, rankFeatures, regionSummary, runQuery, searchSpecies, speciesProfile } from "./query.js";

const VERSION = "0.1.0";

type Args = Record<string, unknown>;

const str = (args: Args, key: string, fallback?: string): string => {
  const v = args[key];
  if (v === undefined || v === null) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${key} is required`);
  }
  if (typeof v !== "string") throw new Error(`${key} must be a string, not ${typeof v}`);
  return v;
};

const int = (args: Args, key: string): number | undefined => {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isInteger(v)) throw new Error(`${key} must be a whole number`);
  return v;
};

const bool = (args: Args, key: string): boolean | undefined => {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") throw new Error(`${key} must be true or false`);
  return v;
};

const SCOPE = {
  type: "string",
  description: `"all", or a rank and a name as the build spells it: ${RANKS.map((r) => `"${r}:Name"`).join(", ")}. Example: "class:Mammalia".`,
} as const;

const TRAIT = {
  type: "string",
  description:
    'The life-history trait, default "maxLongevityYears". Others in this build include adultWeightG, gestationDays, femaleMaturityDays, metabolicRateW and bodyTemperatureK; build_info lists what is there.',
} as const;

const DATASET_ARG = {
  type: "string",
  description:
    '"default" (every non-retired species whose lifespan is neither estimated nor of low quality, from any source) or "anage_only" (AnAge lifespans alone). build_info gives the exact filters of each.',
} as const;

interface Tool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  run: (db: DatabaseSync, args: Args) => unknown;
}

const TOOLS: Tool[] = [
  {
    name: "build_info",
    description:
      "Which MitoAge build this server serves, how many rows each table holds, the filters of each correlation dataset, and every upstream source with its version and licence. Read this before quoting a number, and cite the build.",
    inputSchema: { type: "object", properties: {} },
    run: (db) => buildFacts(db),
  },
  {
    name: "search_species",
    description:
      "Find species by scientific name, common name or slug, longest-lived first. Returns the identifiers, the lifespan with its source and quality, and the headline mtDNA numbers.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: 'Part of a name, case-insensitive: "whale", "Balaena", "bowhead".' },
        scope: SCOPE,
        limit: { type: "integer", description: "Rows to return, default 25, at most 200." },
      },
    },
    run: (db, a) => searchSpecies(db, { query: a["query"] === undefined ? undefined : str(a, "query"), scope: str(a, "scope", "all"), limit: int(a, "limit") }),
  },
  {
    name: "species_profile",
    description:
      "One species by slug, scientific name or common name: its record, the composition of every region of its mitogenome, its structural features, and every lifespan observation with the source each came from. A retired record says so.",
    inputSchema: {
      type: "object",
      properties: { species: { type: "string", description: 'Slug, scientific name or common name: "balaena-mysticetus", "Balaena mysticetus", "bowhead whale".' } },
      required: ["species"],
    },
    run: (db, a) => speciesProfile(db, str(a, "species")),
  },
  {
    name: "correlation",
    description:
      "The correlation of one mtDNA feature with one trait, as MitoAge computed it: Pearson r and Spearman rho, the p-value, the Benjamini-Hochberg q-value across the features of that trait and scope, the partial correlation controlling for body mass, the correlation on phylogenetically independent contrasts, and a plain verdict on what it survives. Use this rather than correlating columns of the downloads yourself: on this data most raw correlations do not survive the controls.",
    inputSchema: {
      type: "object",
      properties: {
        feature_key: { type: "string", description: 'The feature, as the catalogue spells it: "gc:total_mtDNA", "gcSkew:total_mtDNA", "size:total_mtDNA". rank_features lists them.' },
        trait: TRAIT,
        scope: SCOPE,
        dataset: DATASET_ARG,
      },
      required: ["feature_key"],
    },
    run: (db, a) =>
      correlation(db, {
        featureKey: str(a, "feature_key"),
        trait: str(a, "trait", "maxLongevityYears"),
        scope: str(a, "scope", "all"),
        dataset: str(a, "dataset", "default"),
      }),
  },
  {
    name: "rank_features",
    description:
      "The mtDNA features of one trait and scope, strongest correlation first, each with its q-value, both controls and a verdict. Set only_surviving to keep those that pass the false discovery rate and still hold on phylogenetically independent contrasts with the same sign.",
    inputSchema: {
      type: "object",
      properties: {
        trait: TRAIT,
        scope: SCOPE,
        dataset: DATASET_ARG,
        only_surviving: { type: "boolean", description: "Keep only the features that pass the false discovery rate and hold on contrasts, same sign. Default false." },
        limit: { type: "integer", description: "Rows to return, default 25, at most 200. The count of features assessed is returned whatever the limit." },
      },
    },
    run: (db, a) =>
      rankFeatures(db, {
        trait: str(a, "trait", "maxLongevityYears"),
        scope: str(a, "scope", "all"),
        dataset: str(a, "dataset", "default"),
        onlySurviving: bool(a, "only_surviving"),
        limit: int(a, "limit"),
      }),
  },
  {
    name: "region_summary",
    description:
      "Counts, means and ranges of GC %, the skews and the length of every region of the mitogenome across the species of a scope, computed from the published rows. These are descriptive only: for a relationship with lifespan use correlation or rank_features, which carry the controls.",
    inputSchema: {
      type: "object",
      properties: {
        scope: SCOPE,
        region: { type: "string", description: 'One region, such as "total_mtDNA", "COX1", "D-loop". Left out, every region is returned.' },
      },
    },
    run: (db, a) => regionSummary(db, { scope: str(a, "scope", "all"), region: a["region"] === undefined ? undefined : str(a, "region") }),
  },
  {
    name: "query",
    description:
      "Run a read-only SQL query against the build. Tables: species, region_stats, codon_usage, genome_features, protein_gene_features, mtdna_structure, lifespan_observations, changelog, correlations, build_info, correlation_dataset, source. Columns are the published ones. A correlation read this way comes without a verdict: keep q_value, pic_r and partial_r beside pearson_r, or use the correlation tool.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "One statement, starting with SELECT or WITH." },
        limit: { type: "integer", description: "Rows to return, default 100, at most 1000." },
      },
      required: ["sql"],
    },
    run: (db, a) => runQuery(db, str(a, "sql"), int(a, "limit")),
  },
];

const INSTRUCTIONS = [
  "MitoAge: the mitochondrial genomes of animal species against their maximum lifespan, build 2.",
  "Every correlation this server returns carries its false discovery rate, a partial correlation controlling for body mass and a correlation on phylogenetically independent contrasts.",
  "Across this data most raw correlations with lifespan do not survive those controls, so do not report a Pearson r from here without them, and do not correlate the columns yourself when a tool already has the answer.",
  "Quote the build, and cite Toren et al. 2016, Nucleic Acids Res 44:D1262-D1265.",
  "Lifespan values whose source is FishBase or SeaLifeBase are CC BY-NC 4.0; each species row carries its lifespan_license.",
].join(" ");

async function main(): Promise<void> {
  const opened = await openDatabase(DATASET);
  const server = new Server({ name: "mitoage", version: VERSION }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const tool = TOOLS.find((t) => t.name === request.params.name);
    if (!tool) {
      return { isError: true, content: [{ type: "text" as const, text: `no tool "${request.params.name}"; this server has ${TOOLS.map((t) => t.name).join(", ")}` }] };
    }
    try {
      const result = tool.run(opened.db, (request.params.arguments ?? {}) as Args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      // The reason reaches the caller: a tool that answers "no rows" when it could not run would be
      // read as a finding about the data.
      return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] };
    }
  });

  const facts = buildFacts(opened.db);
  // stderr, never stdout: stdout carries the protocol.
  console.error(
    `mitoage-mcp ${VERSION}: ${facts.build}, ${(opened.bytes / 1e6).toFixed(0)} MB from ${opened.source}` +
      `${opened.revision === null ? "" : ` at ${opened.revision.slice(0, 12)}`} (${opened.path})`,
  );
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error(`mitoage-mcp: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
