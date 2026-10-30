// Renders each overlay listed in a JSON file to a PNG in the explorer's face:
//   node film/build/render-overlays.mjs <overlays.json> <out dir>
// overlays.json: [{ "id": "...", "kind": "band" | "card" | "end", "aspect": "16x9" | "9x16", ... }]
import { chromium } from "../../web/node_modules/playwright/index.mjs";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [list, out] = process.argv.slice(2);
if (!list || !out) throw new Error("usage: render-overlays.mjs <overlays.json> <out dir>");
mkdirSync(out, { recursive: true });
const page_url = pathToFileURL(new URL("overlay.html", import.meta.url).pathname).href;
const browser = await chromium.launch();
let n = 0;
for (const o of JSON.parse(readFileSync(list, "utf8"))) {
  const path = `${out}/${o.id}.png`;
  if (existsSync(path)) continue; // ids are content hashes
  const [w, h] = o.aspect === "9x16" ? [1080, 1920] : [1920, 1080];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(`${page_url}#${encodeURIComponent(JSON.stringify(o))}`);
  await page.waitForSelector("body[data-ready]");
  const fam = await page.evaluate(() => [...document.fonts].some((f) => f.family.includes("Geist") && f.status === "loaded"));
  if (!fam) throw new Error("Geist did not load");
  await page.screenshot({ path, omitBackground: o.kind === "band" });
  await page.close();
  n++;
}
await browser.close();
console.log(`rendered ${n} overlays`);
