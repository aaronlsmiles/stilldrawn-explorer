// Lighthouse on the login-protected preview: every view on a simulated phone and on desktop, three
// runs each, median LCP and the element it was. Pinned lighthouse@13.5.0 (fetched by npx).
//
//   op run --env-file=$HOME/projects/studio/tools/stilldrawn-explorer.env.op -- \
//     env PREVIEW_URL=https://<preview>.vercel.app node tools/lighthouse-preview.mjs [runs]
//
// The deployment's bypass cookie (7 days, HttpOnly, host-only) is set in a throwaway Chromium profile
// through an API request, so the secret never sits in a page URL and never reaches the media host
// (Lighthouse's --extra-headers would send it there). Lighthouse then launches the same binary on
// that profile. Keeping the cookie means skipping Lighthouse's storage reset, which would also keep
// the HTTP cache from run to run, so every run first deletes the profile's caches: each run is cold.
// Reports land in a temp folder, printed at the end.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = (process.env.PREVIEW_URL ?? "").replace(/\/$/, "");
if (!base || !process.env.VERCEL_BYPASS) throw new Error("PREVIEW_URL and VERCEL_BYPASS must be set (run under op run)");
const runs = Number(process.argv[2] ?? 3);
const out = mkdtempSync(join(tmpdir(), "lh-")), profile = join(out, "chrome-profile");

const ctx = await chromium.launchPersistentContext(profile, { headless: true, channel: "chromium" });
const r = await ctx.request.head(`${base}/?x-vercel-protection-bypass=${encodeURIComponent(process.env.VERCEL_BYPASS)}&x-vercel-set-bypass-cookie=true`);
if (r.status() !== 200) throw new Error(`bypass cookie: HTTP ${r.status()}`);
await ctx.close();
const env = { ...process.env, CHROME_PATH: chromium.executablePath(), VERCEL_BYPASS: "" };

const VIEWS = [["explore", "/explore"], ["failures", "/explore/failures"], ["scatter", "/scatter"], ["tax", "/tax"], ["rate", "/rate"]];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`${"view".padEnd(10)}${"device".padEnd(9)}${"LCP median (runs)".padEnd(32)}LCP element`);
for (const form of ["mobile", "desktop"]) {
  for (const [name, path] of VIEWS) {
    const lcp = [];
    let element = "";
    for (let i = 0; i < runs; i++) {
      const file = join(out, `${name}-${form}-${i}.json`);
      for (const c of ["Cache", "Code Cache", "GPUCache"]) rmSync(join(profile, "Default", c), { recursive: true, force: true });
      execFileSync("npx", ["--yes", "lighthouse@13.5.0", base + path,
        `--chrome-flags=--headless=new --use-mock-keychain --password-store=basic --user-data-dir=${profile}`,
        "--disable-storage-reset", "--only-categories=performance", "--output=json", `--output-path=${file}`, "--quiet",
        ...(form === "desktop" ? ["--preset=desktop"] : [])], { stdio: "inherit", env });
      const a = JSON.parse(readFileSync(file, "utf8")).audits;
      lcp.push(a["largest-contentful-paint"].numericValue / 1000);
      // Lighthouse 13 names the element in the LCP breakdown insight
      const node = a["lcp-breakdown-insight"]?.details?.items?.find((x) => x.type === "node");
      element = node ? `${node.selector} (${node.nodeLabel.slice(0, 40)})` : element;
    }
    const m = median(lcp);
    console.log(`${name.padEnd(10)}${form.padEnd(9)}${`${m.toFixed(1)} s ${m <= 2.5 ? "ok " : "MISS"} (${lcp.map((x) => x.toFixed(1)).join(", ")})`.padEnd(32)}${element}`);
  }
}
console.log(`reports: ${out}`);
