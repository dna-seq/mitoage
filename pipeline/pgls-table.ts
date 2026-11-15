/**
 * A second ancestry control for every lifespan test of the correlation table: phylogenetic generalised least
 * squares with Pagel's lambda (pipeline/lib/pgls.ts), the analysis A3 of docs/REVIEW_ANALYSES_PLAN.md (D18).
 * Run on the cluster through pipeline/pgls-table.sbatch, one Slurm array task per scope.
 *
 *   bun run pipeline/pgls-table.ts scopes                    # list the scopes with lifespan tests, one per line
 *   bun run pipeline/pgls-table.ts fit <scope> <out.tsv>     # one scope's lifespan tests
 *   bun run pipeline/pgls-table.ts summarize <dir> <out.tsv> # the per-scope counts, from the scopes' files
 *
 * For each lifespan test (dataset "default", trait maxLongevityYears), on the species of the test that have a
 * place in the dated tree, the feature is the response and log10 maximum lifespan the predictor:
 *   - pgls_*: feature ~ log10 lifespan, lambda estimated by maximum likelihood in [0, 1];
 *   - pgls_mass_*: feature ~ log10 lifespan + log10 adult body mass, on the species with a mass (at least 10, the
 *     table's minimum for the partial correlation), lambda estimated again; the slope reported is lifespan's.
 * The feature is the response because lambda describes the residual of a response, as in the H1 and H11 models
 * of mitoage-pipelines. The model is not symmetric in the two traits, unlike the correlations it stands beside.
 *
 * Check, on every test: with lambda fixed at 1 the model is Brownian motion on the tree, and the slope's p value
 * must equal the table's contrast p value (pic_p_value; with mass, pic_mass_p_value). A difference above 1e-6
 * relative is counted, printed, and fails the task.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nodeDepths, pgls, pglsAt, type PglsFit } from "./lib/pgls";
import { benjaminiHochberg, compileTree } from "./lib/stats";
import { computeCorrelations, log10OrNull, MIN_PAIRS } from "./steps/correlations";
import { getAllSpecies, getFeatureDefs, getFeatureValueArrays, getPhylogeny } from "../src/data";

function load() {
  const species = getAllSpecies();
  const { values } = getFeatureValueArrays();
  const phylo = getPhylogeny();
  if (!phylo) throw new Error("the build has no dated tree (src/data/generated/phylogeny.json): PGLS cannot be fitted");
  const indexOf = new Map(species.map((s, i) => [s.id, i]));
  const tree = compileTree(phylo.root, (leaf) => indexOf.get(leaf));
  const { rows, scopes } = computeCorrelations(species, getFeatureDefs(), values, tree, "default");
  const lifespan = Float64Array.from(species.map((s) => log10OrNull(s.maxLongevityYears) ?? NaN));
  const mass = Float64Array.from(species.map((s) => log10OrNull(s.traits.adultWeightG) ?? NaN));
  const lifespanRows = rows.filter((r) => r.trait === "maxLongevityYears");
  return { species, values, tree, depth: nodeDepths(tree), scopes, lifespanRows, lifespan, mass };
}

const fmt = (v: number | null | undefined) => (v !== null && v !== undefined && Number.isFinite(v) ? String(+v.toPrecision(8)) : "");
const HEAD = [
  "scope", "feature", "n", "pearson_r", "p_value", "q_value", "pic_r", "pic_p_value", "pic_mass_p_value",
  "pgls_n", "pgls_lambda", "pgls_slope", "pgls_se", "pgls_p", "pgls_loglik", "pgls_bm_p", "pgls_refused",
  "pgls_mass_n", "pgls_mass_lambda", "pgls_mass_slope", "pgls_mass_se", "pgls_mass_p", "pgls_mass_loglik", "pgls_mass_bm_p", "pgls_mass_refused",
];

function fit(scopeKey: string, outPath: string) {
  const d = load();
  const scope = d.scopes.find((s) => s.key === scopeKey);
  if (!scope) throw new Error(`no scope ${scopeKey}; \`scopes\` lists them`);
  const nSpecies = d.species.length;
  const rows = d.lifespanRows.filter((r) => r.scope === scopeKey).sort((a, b) => (a.featureKey < b.featureKey ? -1 : a.featureKey > b.featureKey ? 1 : 0));
  const lines = [HEAD.join("\t")];
  let mismatches = 0;
  const refusals = new Map<string, number>();
  const refuse = (why: string) => refusals.set(why, (refusals.get(why) ?? 0) + 1);
  const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
  for (const row of rows) {
    const fx = d.values.get(row.featureKey)!;
    const x = new Float64Array(nSpecies).fill(NaN);
    for (const i of scope.members) {
      const v = fx[i];
      if (v !== null && v !== undefined && Number.isFinite(d.lifespan[i]!)) x[i] = v;
    }
    const one = pgls(d.tree, d.depth, x, [d.lifespan]);
    const oneBM = pglsAt(d.tree, d.depth, 1, x, [d.lifespan]);
    let massN = 0;
    for (const i of scope.members) if (Number.isFinite(x[i]!) && Number.isFinite(d.mass[i]!)) massN++;
    const two: PglsFit | string = massN >= MIN_PAIRS ? pgls(d.tree, d.depth, x, [d.lifespan, d.mass]) : "too-few-masses";
    const twoBM: PglsFit | string = massN >= MIN_PAIRS ? pglsAt(d.tree, d.depth, 1, x, [d.lifespan, d.mass]) : "too-few-masses";
    if (typeof one === "string") refuse(`lifespan: ${one}`);
    if (typeof two === "string") refuse(`lifespan + mass: ${two}`);
    if (typeof oneBM !== "string" && row.picPValue !== null && rel(oneBM.p[0]!, row.picPValue) > 1e-6) mismatches++;
    if (typeof twoBM !== "string" && row.picMassPValue != null && rel(twoBM.p[0]!, row.picMassPValue) > 1e-6) mismatches++;
    const cells = (f: PglsFit | string, bm: PglsFit | string) =>
      typeof f === "string"
        ? ["", "", "", "", "", "", typeof bm === "string" ? "" : fmt(bm.p[0]), f]
        : [String(f.n), fmt(f.lambda), fmt(f.coef[0]), fmt(f.se[0]), fmt(f.p[0]), fmt(f.logLik), typeof bm === "string" ? "" : fmt(bm.p[0]), ""];
    lines.push([
      scopeKey, row.featureKey, row.n, fmt(row.pearsonR), fmt(row.pValue), fmt(row.qValue), fmt(row.picR), fmt(row.picPValue), fmt(row.picMassPValue),
      ...cells(one, oneBM), ...cells(two, twoBM),
    ].join("\t"));
  }
  writeFileSync(outPath, `${lines.join("\n")}\n`);
  const why = [...refusals].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k} ${v}`).join("; ");
  console.log(`${scopeKey}: ${rows.length} lifespan tests; refused: ${why || "none"}; lambda = 1 p values differing from the table: ${mismatches}`);
  if (mismatches) process.exitCode = 1;
}

/** Per-scope counts beside Table 3's funnel. Each count is over the tests that pass the FDR across species. */
function summarize(dir: string, outPath: string) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".tsv")).sort();
  const head = [
    "scope", "tests", "fdr", "pgls_fitted", "pgls_p05", "pgls_q05", "fdr_and_pgls", "fdr_and_pgls_mass", "fdr_and_pic", "fdr_and_pic_and_pgls",
    "lambda_median", "lambda_at_0", "lambda_at_1",
  ];
  const out = [head.join("\t")];
  const tot = new Map<string, number>();
  for (const f of files) {
    const [h, ...body] = readFileSync(join(dir, f), "utf8").trimEnd().split("\n");
    const col = new Map(h!.split("\t").map((c, i) => [c, i]));
    const rows = body.map((l) => l.split("\t"));
    const num = (r: string[], c: string) => (r[col.get(c)!] === "" ? NaN : Number(r[col.get(c)!]));
    const sameSign = (r: string[], c: string) => Math.sign(num(r, c)) === Math.sign(num(r, "pearson_r"));
    const fitted = rows.filter((r) => Number.isFinite(num(r, "pgls_p")));
    const q = benjaminiHochberg(fitted.map((r) => num(r, "pgls_p")));
    const lambdas = fitted.map((r) => num(r, "pgls_lambda")).sort((a, b) => a - b);
    const fdr = rows.filter((r) => num(r, "q_value") < 0.05);
    const pglsPass = (r: string[]) => num(r, "pgls_p") < 0.05 && sameSign(r, "pgls_slope");
    const picPass = (r: string[]) => num(r, "pic_p_value") < 0.05 && sameSign(r, "pic_r");
    const counts: Record<string, number> = {
      tests: rows.length,
      fdr: fdr.length,
      pgls_fitted: fitted.length,
      pgls_p05: fitted.filter((r) => num(r, "pgls_p") < 0.05).length,
      pgls_q05: q.filter((v) => v < 0.05).length,
      fdr_and_pgls: fdr.filter(pglsPass).length,
      fdr_and_pgls_mass: fdr.filter((r) => num(r, "pgls_mass_p") < 0.05 && sameSign(r, "pgls_mass_slope")).length,
      fdr_and_pic: fdr.filter(picPass).length,
      fdr_and_pic_and_pgls: fdr.filter((r) => picPass(r) && pglsPass(r)).length,
    };
    for (const [k, v] of Object.entries(counts)) tot.set(k, (tot.get(k) ?? 0) + v);
    const scope = rows[0]?.[0] ?? f;
    out.push([
      scope, ...Object.values(counts).map(String),
      lambdas.length ? fmt(lambdas[lambdas.length >> 1]!) : "",
      String(lambdas.filter((l) => l < 1e-4).length), String(lambdas.filter((l) => l > 1 - 1e-4).length),
    ].join("\t"));
  }
  out.push(["total", ...["tests", "fdr", "pgls_fitted", "pgls_p05", "pgls_q05", "fdr_and_pgls", "fdr_and_pgls_mass", "fdr_and_pic", "fdr_and_pic_and_pgls"].map((k) => String(tot.get(k) ?? 0)), "", "", ""].join("\t"));
  writeFileSync(outPath, `${out.join("\n")}\n`);
  console.log(out.join("\n"));
}

if (import.meta.main) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "scopes") {
    const d = load();
    const counts = new Map<string, number>();
    for (const r of d.lifespanRows) counts.set(r.scope, (counts.get(r.scope) ?? 0) + 1);
    for (const s of d.scopes) if (counts.get(s.key)) console.log(s.key);
  } else if (cmd === "fit" && args.length === 2) fit(args[0]!, args[1]!);
  else if (cmd === "summarize" && args.length === 2) summarize(args[0]!, args[1]!);
  else {
    console.error("usage: bun run pipeline/pgls-table.ts scopes | fit <scope> <out.tsv> | summarize <dir> <out.tsv>");
    process.exitCode = 2;
  }
}
