#!/usr/bin/env node
// Asserts the staged deploy folder's layout: the built app under public/, the API
// functions with the vendored kit, and a vercel.json with rewrites, cron and headers.
// Usage: node tools/check-stage.mjs deploy/<mode> [preview|production]   (exit 1 on any failure)
// A preview must carry noindex; production must not (it is meant to be found).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
const mode = process.argv[3] ?? "preview";
if (!dir || !["preview", "production"].includes(mode)) { console.error("usage: check-stage.mjs <staged dir> [preview|production]"); process.exit(2); }
const repo = fileURLToPath(new URL("..", import.meta.url));
const fails = [];
const check = (ok, what) => { if (!ok) fails.push(what); };
const at = (p) => join(dir, p);
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const STUDY = "public/data/blindpanel/stilldrawn/study.json";
for (const p of ["public/index.html", "public/data/v1/index.json", "public/fonts/geist-latin.woff2", "public/fonts/geist-mono-latin.woff2", "public/fonts/OFL.txt", ...["scatter", "tax"].flatMap((f) => ["light", "dark", "phone-light", "phone-dark"].map((t) => `public/thesis/${f}-${t}.png`)), STUDY, "api/_lib.ts", "api/submit.ts", "api/tally.ts", "api/keepwarm.ts", "package.json", "package-lock.json", "vercel.json"])
  check(existsSync(at(p)), `missing ${p}`);
if (existsSync(at(STUDY))) check(sha(at(STUDY)) === sha(join(repo, "web", STUDY)), "staged study.json differs from web/public");

const lock = json(join(repo, "web/vendor/blindpanel.lock.json"));
if (existsSync(at("package.json"))) {
  const pkg = json(at("package.json"));
  check(pkg.private === true && pkg.type === "module", "package.json must be private and type module");
  check(pkg.engines?.node === "24.x", "package.json engines.node must be 24.x");
  check(pkg.dependencies?.blindpanel === `file:vendor/${lock.tarball}`, "package.json must depend on the vendored tarball");
}
const tgz = at(`vendor/${lock.tarball}`);
check(existsSync(tgz) && sha(tgz) === lock.tarball_sha256, "vendored tarball missing or its sha256 differs from the lock");

if (existsSync(at("vercel.json"))) {
  const v = json(at("vercel.json"));
  const crons = v.crons ?? [];
  check(crons.length === 1 && crons[0].path === "/api/keepwarm" && /^\d+ \d+ \* \* \*$/.test(crons[0].schedule), "one daily cron for /api/keepwarm");
  check((v.functions?.["api/*.ts"]?.includeFiles ?? "").includes("study.json"), "functions must include the study file");
  const rw = v.rewrites?.[0]?.source ?? "";
  for (const p of ["api/", "assets/", "data/", "fonts/", "thesis/", "favicon"]) check(rw.includes(p), `SPA rewrite must exclude ${p}`);
  const robots = (v.headers ?? []).flatMap((h) => h.headers).find((h) => h.key === "X-Robots-Tag");
  if (mode === "preview") check(robots?.value === "noindex, nofollow", "a preview needs the noindex header");
  else check(!robots, "production must not send X-Robots-Tag");
}

function* walk(d) {
  for (const n of readdirSync(d)) {
    if (n === ".vercel") continue;
    const p = join(d, n);
    yield p;
    if (statSync(p).isDirectory()) yield* walk(p);
  }
}
for (const p of walk(dir)) {
  const r = relative(dir, p);
  check(!/(^|\/)(\.env[^/]*|node_modules|[^/]*\.op|[^/]*banned-terms[^/]*|[^/]*\.test\.tsx?)$/.test(r), `must not be staged: ${r}`);
}

if (fails.length) { console.error(`stage check FAILED (${dir}):\n  - ${fails.join("\n  - ")}`); process.exit(1); }
console.log(`stage check passed (${dir})`);
