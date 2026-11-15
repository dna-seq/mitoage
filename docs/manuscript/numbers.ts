// The numbers the manuscript takes from a build, recomputed from the build's own files.
//
//   bun docs/manuscript/numbers.ts [ROOT] [--s1]   # ROOT: a checkout with public/data/ and dist/ (`bun run build`)
//
// Prints one `key<TAB>value` line per number, in a fixed order, so two builds can be compared with `diff`
// and every changed number found in the text. Definitions are those of docs/manuscript/NOTES.md, "Where the
// numbers come from" (Table 3: FDR q < 0.05; PIC p < 0.05; Both adds the same sign; All three adds partial
// p < 0.05; PIC + mass is FDR and pic_mass p < 0.05 with the same sign; the sign-flip column is FDR and
// pic_signflip_p < 0.05 with the same sign; PGLS is FDR and pgls_p < 0.05 with the slope's sign the
// correlation's, read from docs/analyses/pgls/scopes/ of the repository this script is in, D18 and D19).
// Correlations: dataset `default` unless named, trait maxLongevityYears. The numbers from mitoage-pipelines'
// analyses and from the screenshots are not here.

import { parquetReadObjects } from "hyparquet";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? join(import.meta.dir, "../.."));
const need = (p: string) => {
  const f = join(root, p);
  if (!existsSync(f)) throw new Error(`missing ${f}${p.startsWith("dist/") ? " (run `bun run build` there)" : ""}`);
  return f;
};
const read = async (p: string, columns?: string[]) =>
  (await parquetReadObjects({ file: await Bun.file(need(p)).arrayBuffer(), ...(columns ? { columns } : {}) })) as Record<string, any>[];

const out: [string, string | number][] = [];
const put = (k: string, v: string | number) => out.push([k, v]);
const r2 = (x: number) => x.toFixed(2);
const r3 = (x: number) => x.toFixed(3);

// ------------------------------------------------------------------ species
const species = await read("public/data/species.parquet");
const live = species.filter((s) => s.record_status !== "retired");
const isNew = (s: Record<string, any>) => s.record_status === "new";
put("species.total", species.length);
for (const st of ["original", "updated", "renamed", "retired", "new"]) put(`species.status.${st}`, species.filter((s) => s.record_status === st).length);
put("species.live", live.length);
put("species.live.classes", new Set(live.map((s) => s.class).filter(Boolean)).size);
put("species.live.phyla", new Set(live.map((s) => s.phylum).filter(Boolean)).size);
for (const src of ["AnAge", "FishBase", "SeaLifeBase", "EURING", "USGS_BBL"]) put(`species.new.source.${src}`, species.filter((s) => isNew(s) && s.lifespan_source === src).length);
for (const src of ["AnAge", "FishBase", "SeaLifeBase", "EURING", "USGS_BBL"]) put(`species.live.source.${src}`, live.filter((s) => s.lifespan_source === src).length);

// Table 1, grouped as in the 2016 paper.
const FISH = new Set(["Actinopterygii", "Sarcopterygii", "Cephalaspidomorphi", "Chondrichthyes", "Myxini"]);
const group = (s: Record<string, any>) =>
  s.phylum !== "Chordata" ? "nonchordates"
  : ["Mammalia", "Aves", "Reptilia", "Amphibia"].includes(s.class) ? s.class
  : FISH.has(s.class) ? "fishes"
  : "otherchordates";
for (const g of ["Mammalia", "Aves", "Reptilia", "Amphibia", "fishes", "otherchordates", "nonchordates"]) {
  put(`table1.${g}.live`, live.filter((s) => group(s) === g).length);
  put(`table1.${g}.new`, live.filter((s) => group(s) === g && isNew(s)).length);
}
put("table1.total.new", live.filter(isNew).length);
for (const c of ["Bivalvia", "Malacostraca", "Cephalopoda"]) put(`species.live.${c}`, live.filter((s) => s.class === c).length);
put("species.live.invertebrates", live.filter((s) => group(s) === "nonchordates" || group(s) === "otherchordates").length);
put("species.live.mammals.gestation", live.filter((s) => s.class === "Mammalia" && s.gestation_days != null).length);
put("species.live.mammals.femaleMaturity", live.filter((s) => s.class === "Mammalia" && s.female_maturity_days != null).length);
put("species.live.mammals.birthWeight", live.filter((s) => s.class === "Mammalia" && s.birth_weight_g != null).length);
put("species.live.estimated", live.filter((s) => s.lifespan_record_type === "estimated").length);
put("species.live.low", live.filter((s) => s.lifespan_quality === "low").length);
put("species.live.questionable", live.filter((s) => s.lifespan_quality === "questionable" && s.lifespan_record_type !== "estimated").length);

// ------------------------------------------------------------------ changelog, review list, observations, tree
const changelog = await read("public/data/changelog.parquet", ["change_type"]);
put("changelog.rows", changelog.length);
for (const t of ["added", "value_update", "correction", "renamed", "retired"]) put(`changelog.${t}`, changelog.filter((c) => c.change_type === t).length);
const review = readFileSync(need("public/data/review_list.csv"), "utf8").trim().split("\n").slice(1);
put("review.rows", review.length);
put("review.unmatched", review.filter((l) => l.startsWith("source_name_unmatched")).length);
put("lifespan_observations.rows", (await read("public/data/lifespan_observations.parquet", ["source"])).length);
const notes = readFileSync(need("public/data/README.md"), "utf8");
const tree = /induced subtree of (\d+) of (\d+) species.*?TimeTree 5 API for (\d+) of (\d+) internal nodes; (\d+) undated.*?(\d+) ages raised.*?(\d+) species are not in the tree/s.exec(notes);
if (!tree) throw new Error("public/data/README.md: no dated-tree note");
["placed", "of", "dated", "nodes", "interpolated", "raised", "outside"].forEach((k, i) => put(`tree.${k}`, Number(tree[i + 1])));

// Lifespan values of the live species by source, quality and record type (Supplementary S4).
for (const src of ["AnAge", "FishBase", "SeaLifeBase", "EURING", "USGS_BBL", "*"]) {
  const L = live.filter((s) => src === "*" || s.lifespan_source === src);
  for (const q of ["acceptable", "high", "low", "questionable"]) put(`lifespan.${src}.${q}`, L.filter((s) => s.lifespan_quality === q).length);
  for (const t of ["captive", "wild", "observed", "estimated"]) put(`lifespan.${src}.${t}`, L.filter((s) => s.lifespan_record_type === t).length);
}
const orient = /Orientation of the RefSeq records \(canonical (\d+), noncanonical (\d+), not_chordate (\d+), unknown (\d+)\)/.exec(notes);
if (!orient) throw new Error("public/data/README.md: no orientation note");
["canonical", "noncanonical", "not_chordate", "unknown"].forEach((k, i) => put(`orientation.${k}`, Number(orient[i + 1])));
const arc = /Major arc defined for (\d+) of (\d+) species; the two deletion contact zones \(ATP8-COX3 and ND5-CYTB\) for (\d+)/.exec(notes);
if (!arc) throw new Error("public/data/README.md: no major-arc note");
put("majorArc.defined", Number(arc[1]));
put("contactZones.defined", Number(arc[3]));
// Dated tree structure: internal nodes, polytomies, branches below the root and those of length zero.
type Node = { length?: number; children?: Node[] };
const phylo = JSON.parse(readFileSync(need("src/data/generated/phylogeny.json"), "utf8")) as { root: Node };
let internal = 0, poly = 0, branches = 0, zero = 0;
const walk = (n: Node, isRoot: boolean) => {
  if (!isRoot) { branches++; if ((n.length ?? 0) === 0) zero++; }
  if (n.children?.length) { internal++; if (n.children.length > 2) poly++; n.children.forEach((c) => walk(c, false)); }
};
walk(phylo.root, true);
put("tree.internal", internal);
put("tree.polytomies", poly);
put("tree.branches", branches);
put("tree.zeroBranches", zero);

// ------------------------------------------------------------------ correlations
type Row = Record<string, any>;
const corr = (await read("dist/data/correlations.parquet")).filter((r) => r.trait === "maxLongevityYears");
const lt = (x: number | null) => x != null && Number.isFinite(x) && x < 0.05;
const same = (a: number | null, b: number | null) => a != null && b != null && Math.sign(a) === Math.sign(b);
const fdr = (r: Row) => lt(r.q_value);
const both = (r: Row) => fdr(r) && lt(r.pic_p_value) && same(r.pearson_r, r.pic_r);
const flip = (r: Row) => fdr(r) && lt(r.pic_signflip_p) && same(r.pearson_r, r.pic_r);
const all3 = (r: Row) => both(r) && lt(r.partial_p_value);
const mass = (r: Row) => fdr(r) && lt(r.pic_mass_p_value) && same(r.pearson_r, r.pic_mass_r);
const count = (rows: Row[], f: (r: Row) => boolean) => rows.filter(f).length;

// PGLS with Pagel's lambda (docs/analyses/pgls/, D18): computed on the cluster, not by the site build, so it is
// joined to this build's rows by scope and feature, and refused if the run's correlations are not this build's.
const pglsDir = join(import.meta.dir, "../analyses/pgls/scopes");
const pgls = new Map<string, { p: number; slope: number; massP: number; massSlope: number; r: number; q: number }>();
for (const f of readdirSync(pglsDir).filter((x) => x.endsWith(".tsv")).sort()) {
  const [head, ...body] = readFileSync(join(pglsDir, f), "utf8").trimEnd().split("\n");
  const col = new Map(head!.split("\t").map((c, i) => [c, i]));
  for (const line of body) {
    const c = line.split("\t");
    const num = (k: string) => (c[col.get(k)!] === "" ? NaN : Number(c[col.get(k)!]));
    pgls.set(`${c[0]}|${c[1]}`, { p: num("pgls_p"), slope: num("pgls_slope"), massP: num("pgls_mass_p"), massSlope: num("pgls_mass_slope"), r: num("pearson_r"), q: num("q_value") });
  }
}
{
  const defRows = corr.filter((r) => r.dataset === "default");
  let missing = 0, differ = 0;
  for (const r of defRows) {
    const g = pgls.get(`${r.scope}|${r.feature_key}`);
    if (!g) { missing++; continue; }
    const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));
    if (rel(g.r, r.pearson_r) > 1e-6 || (Number.isFinite(g.q) && rel(g.q, r.q_value) > 1e-6)) differ++;
  }
  if (missing || differ || pgls.size !== defRows.length)
    throw new Error(`docs/analyses/pgls does not describe this build: ${missing} rows missing, ${differ} differing, ${pgls.size} PGLS rows against ${defRows.length}`);
}
const pg = (r: Row) => pgls.get(`${r.scope}|${r.feature_key}`)!;
const pglsPass = (r: Row) => fdr(r) && lt(pg(r).p) && same(r.pearson_r, pg(r).slope);
const pglsMassPass = (r: Row) => fdr(r) && lt(pg(r).massP) && same(r.pearson_r, pg(r).massSlope);

for (const ds of ["default", "anage_only"]) {
  const rows = corr.filter((r) => r.dataset === ds);
  const scopes = [...new Set(rows.map((r) => r.scope as string))].sort();
  const tot = { tests: 0, p05: 0, fdr: 0, pic: 0, both: 0, flip: 0, all3: 0, mass: 0 };
  for (const sc of scopes) {
    const s = rows.filter((r) => r.scope === sc);
    const c = {
      species: Math.max(...s.map((r) => r.n)), tests: s.length, p05: count(s, (r) => lt(r.p_value)), fdr: count(s, fdr),
      pic: count(s, (r) => lt(r.pic_p_value)), both: count(s, both), flip: count(s, flip), all3: count(s, all3), mass: count(s, mass),
      massN: Math.max(0, ...s.map((r) => r.partial_n ?? 0)),
    };
    for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += c[k];
    if (ds === "default") {
      for (const [k, v] of Object.entries(c)) put(`table3.${sc}.${k}`, v);
      put(`table3.${sc}.pgls`, count(s, pglsPass));
    }
  }
  put(`funnel.${ds}.scopes`, scopes.length);
  for (const [k, v] of Object.entries(tot)) put(`funnel.${ds}.${k}`, v);
}

{
  const d = corr.filter((r) => r.dataset === "default");
  put("pgls.default.fdrSameSign", count(d, pglsPass));
  put("pgls.default.fdrSameSign.mass", count(d, pglsMassPass));
  put("pgls.default.andBoth", count(d, (r) => pglsPass(r) && both(r)));
  put("pgls.default.p05", count(d, (r) => lt(pg(r).p)));
  put("pgls.default.fitted", count(d, (r) => Number.isFinite(pg(r).p)));
  for (const sc of ["all", "class:Mammalia", "class:Actinopterygii", "class:Aves", "class:Amphibia", "class:Bivalvia", "class:Chondrichthyes", "order:Rajiformes", "order:Clupeiformes"]) {
    const s = d.filter((r) => r.scope === sc);
    put(`pgls.${sc}.p05`, count(s, (r) => lt(pg(r).p)));
    put(`pgls.${sc}.fitted`, count(s, (r) => Number.isFinite(pg(r).p)));
  }
}
for (const ds of ["default", "anage_only"]) put(`signflip.${ds}.p05`, count(corr.filter((r) => r.dataset === ds), (r) => lt(r.pic_signflip_p)));
put("funnel.anage_only.mass.of", count(corr.filter((r) => r.dataset === "anage_only"), fdr));
const def = corr.filter((r) => r.dataset === "default");
const A3 = def.filter(all3);
put("funnel.default.all3.sameSignPartial", count(A3, (r) => same(r.pearson_r, r.partial_r)));
// PIC + mass rows whose partial correlation across species also has p < 0.05, of either sign.
put("funnel.default.mass.alsoPartial", count(def, (r) => mass(r) && lt(r.partial_p_value)));
const fam = (r: Row) => String(r.feature_key).split(":")[0]!.replace(/^(gcSkew|atSkew)$/, "skew");
put("funnel.codon.shareOfTests", `${Math.round((100 * count(def, (r) => fam(r) === "codon")) / def.length)}%`);
put("funnel.codon.shareOfAll3", `${Math.round((100 * count(A3, (r) => fam(r) === "codon")) / A3.length)}%`);

// All species.
const all = def.filter((r) => r.scope === "all");
const one = (rows: Row[], key: string) => {
  const r = rows.find((x) => x.feature_key === key);
  if (!r) throw new Error(`no row ${key}`);
  return r;
};
for (const f of ["skew", "gc", "codon"]) {
  const F = all.filter((r) => fam(r) === f);
  put(`all.${f}.fdr`, count(F, fdr));
  put(`all.${f}.all3`, count(F, all3));
  put(`all.${f}.all3.flip`, count(F, (r) => all3(r) && lt(r.pic_signflip_p)));
  put(`all.${f}.all3.mass`, count(F, (r) => all3(r) && lt(r.pic_mass_p_value) && same(r.pearson_r, r.pic_mass_r)));
}
put("all.fdr.picOppositeSign.t", count(all, (r) => fdr(r) && lt(r.pic_p_value) && !same(r.pearson_r, r.pic_r)));
put("all.fdr.picOppositeSign.flip", count(all, (r) => fdr(r) && lt(r.pic_signflip_p) && !same(r.pearson_r, r.pic_r)));
for (const sc of ["class:Mammalia", "class:Chondrichthyes", "order:Rajiformes"]) {
  const s = def.filter((r) => r.scope === sc);
  put(`signflip.${sc}.p05`, count(s, (r) => lt(r.pic_signflip_p)));
}
put("all.partial_n", Math.max(...all.map((r) => r.partial_n ?? 0)));
const gcAll = one(all, "gc:total_mtDNA");
put("all.gc.r", r2(gcAll.pearson_r));
put("all.gc.partial_r", r2(gcAll.partial_r));
const atAll = one(all, "atSkew:total_mtDNA");
put("all.atSkew.r", r2(atAll.pearson_r));
put("all.atSkew.partial_r", r2(atAll.partial_r));
put("all.atSkew.pic_r", r2(atAll.pic_r));
put("all.atSkew.pic_p<1e-6", String(atAll.pic_p_value < 1e-6));
put("all.atSkew.pic_mass_r", r2(atAll.pic_mass_r));
put("all.atSkew.pic_mass_p", r2(atAll.pic_mass_p_value));
// The codons of the total protein-coding sequence that pass all three, by third base and direction.
const codons = all.filter((r) => /^codon:total_pc:[ACGU]{3}$/.test(r.feature_key) && all3(r));
put("all.codon.total_pc.all3", codons.length);
for (const b of ["U", "C", "A", "G"]) {
  const c = codons.filter((r) => r.feature_key.endsWith(b));
  put(`all.codon.total_pc.${b}.down`, count(c, (r) => r.pearson_r < 0));
  put(`all.codon.total_pc.${b}.up`, count(c, (r) => r.pearson_r > 0));
}
const uc = codons.filter((r) => /[UC]$/.test(r.feature_key));
put("all.codon.total_pc.UC.mass", count(uc, (r) => lt(r.pic_mass_p_value) && same(r.pearson_r, r.pic_mass_r)));
put("all.codon.total_pc.UC.flip", count(uc, (r) => lt(r.pic_signflip_p)));
put("all.codon.total_pc.UC.picAbsR", `${r2(Math.min(...uc.map((r) => Math.abs(r.pic_r))))}-${r2(Math.max(...uc.map((r) => Math.abs(r.pic_r))))}`);
put("all.codon.total_pc.UC.list", uc.map((r) => `${r.feature_key.slice(-3)}${r.pearson_r > 0 ? "+" : "-"}`).sort().join(" "));

// Within classes: whole-genome GC.
for (const cl of ["Mammalia", "Actinopterygii", "Aves", "Reptilia"]) {
  const r = one(def.filter((x) => x.scope === `class:${cl}`), "gc:total_mtDNA");
  put(`class.${cl}.gc.n`, r.n);
  put(`class.${cl}.gc.r`, r3(r.pearson_r));
  put(`class.${cl}.gc.partial_r`, r2(r.partial_r));
  put(`class.${cl}.gc.partial_p`, r2(r.partial_p_value));
  put(`class.${cl}.partial_n`, r.partial_n);
}

// Agreement of the two datasets over all features in all species.
const anAll = new Map(corr.filter((r) => r.dataset === "anage_only" && r.scope === "all").map((r) => [r.feature_key, r.pearson_r]));
const pairs = all.filter((r) => r.pearson_r != null && anAll.get(r.feature_key) != null).map((r) => [r.pearson_r, anAll.get(r.feature_key)!] as const);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const [mx, my] = [mean(pairs.map((p) => p[0])), mean(pairs.map((p) => p[1]))];
const cov = mean(pairs.map(([x, y]) => (x - mx) * (y - my)));
const sd = (xs: number[], m: number) => Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
put("datasets.agreement_r", r3(cov / (sd(pairs.map((p) => p[0]), mx) * sd(pairs.map((p) => p[1]), my))));
put("datasets.all.fdr.default", count(all, fdr));
put("datasets.all.fdr.anage_only", count(corr.filter((r) => r.dataset === "anage_only" && r.scope === "all"), fdr));

// `--s1`: Supplementary Table S1 as CSV instead (scopes by species, descending, then by name).
if (process.argv.includes("--s1")) {
  const rows = def;
  const scopes = [...new Set(rows.map((r) => r.scope as string))];
  const lines = ["scope,species,species_with_body_mass,tests,p_lt_0_05,fdr_q_lt_0_05,pic_p_lt_0_05,both_same_sign,both_signflip_same_sign,all_three,pic_rejection_rate_pct,pic_mass_same_sign,pgls_same_sign"];
  const tot = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const recs = scopes.map((sc) => {
    const s = rows.filter((r) => r.scope === sc);
    const species = Math.max(...s.map((r) => r.n));
    const massN = Math.max(0, ...s.map((r) => r.partial_n ?? 0));
    const pic = count(s, (r) => lt(r.pic_p_value));
    const c = [s.length, count(s, (r) => lt(r.p_value)), count(s, fdr), pic, count(s, both), count(s, flip), count(s, all3)];
    c.forEach((v, i) => (tot[i]! += v));
    const m = count(s, mass);
    tot[7]! += m;
    const g = count(s, pglsPass);
    tot[8]! += g;
    return { species, line: `${sc},${species.toFixed(1)},${massN.toFixed(1)},${c.join(",")},${((100 * pic) / s.length).toFixed(1)},${m},${g}` };
  });
  recs.sort((x, y) => y.species - x.species || (x.line < y.line ? -1 : 1)).forEach((r) => lines.push(r.line));
  lines.push(`ALL SCOPES (${scopes.length}),,,${tot.slice(0, 5).join(",")},${tot[5]},${tot[6]},,${tot[7]},${tot[8]}`);
  console.log(lines.join("\n"));
  process.exit(0);
}
for (const [k, v] of out) console.log(`${k}\t${v}`);
