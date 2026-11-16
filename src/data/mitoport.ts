/**
 * The coevolution tables of mitoage-pipelines (D20), read at build time from public/data/mitoport/, which
 * `bun run mitoport` writes. The folder is committed; if it is missing the build stops rather than leave the
 * page and the species sections out without saying so.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MitoportManifest } from "../../pipeline/mitoport";
import { readParquet } from "../../pipeline/lib/parquet";
import { type LifespanNull, lifespanNull } from "../../pipeline/steps/mitoport";
import {
  type ClassDiscordance,
  type GroupSummary,
  type ProteinRow,
  type SpeciesDiscordance,
  classDiscordance,
  groupSummaries,
  joinProteins,
  readDiscordance,
} from "../lib/mitoport";
import { PUBLIC_DIR } from "./index";

const DIR = join(PUBLIC_DIR, "mitoport");
if (!existsSync(join(DIR, "mitoport.json"))) throw new Error(`${DIR}/mitoport.json is missing: run \`bun run mitoport\``);
const read = (file: string) => readParquet(join(DIR, file));

const manifest = JSON.parse(readFileSync(join(DIR, "mitoport.json"), "utf8")) as MitoportManifest;
const [erc, coembed, coupling, partners, lifespan, discordance, sites] = await Promise.all(
  ["erc.parquet", "coembed.parquet", "iface/coupling.parquet", "partners.parquet", "iface/lifespan.parquet", "partners_species.parquet", "iface/contact_map/sites.parquet"].map(read),
);

const proteins = joinProteins(erc!, coembed!, coupling!);
const species = readDiscordance(discordance!);
const bySlug = new Map(species.map((s) => [s.slug, s]));
const classes = classDiscordance(species);

export interface Mitoport {
  manifest: MitoportManifest;
  proteins: ProteinRow[];
  groups: GroupSummary[];
  species: SpeciesDiscordance[];
  classes: ClassDiscordance[];
  /** Whether the tables show no lifespan signal; the page refuses to build when they do not. */
  verdict: LifespanNull;
  /** partners.tsv's rows (H12) and iface/lifespan.tsv's (H9), as read. */
  partners: Record<string, unknown>[];
  lifespan: Record<string, unknown>[];
  /** COX1-3 residues of the contact map in the group "contact". */
  contactResidues: number;
}

const data: Mitoport = {
  manifest,
  proteins,
  groups: groupSummaries(proteins),
  species,
  classes,
  verdict: lifespanNull(partners!, lifespan!),
  partners: partners!,
  lifespan: lifespan!,
  contactResidues: sites!.filter((r) => r["group"] === "contact").length,
};

export const getMitoport = (): Mitoport => data;
export const getSpeciesDiscordance = (slug: string): SpeciesDiscordance | undefined => bySlug.get(slug);
export const getClassDiscordance = (cls: string): ClassDiscordance | undefined => classes.find((c) => c.class === cls);
