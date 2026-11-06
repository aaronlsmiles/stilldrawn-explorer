// Route interception for /tax/masked: the synthetic masked.json states are served from src/views/Tax/__fixtures__
// (never from public/data), and index.json is rewritten so its `masked` flag is true.
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

export type MaskedState = "pending" | "two-rater" | "fallback" | "fallback-late";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MaskedJson = any;
export const loadFixture = (state: MaskedState): MaskedJson =>
  JSON.parse(readFileSync(new URL(`../src/views/Tax/__fixtures__/masked-${state}.json`, import.meta.url), "utf8"));

/** Serve a fixture as masked.json and turn the index flag on. `edit` may change the fixture; `routes` may add more overrides. */
export async function withMasked(page: Page, state: MaskedState = "pending", edit?: (json: MaskedJson) => void) {
  await page.route((u) => u.pathname === "/api/tally", (r) => r.fulfill({ status: 200, json: { study: "x", n_sessions: 0, items: {} } }));
  await page.route("**/data/v1/index.json", async (r) => {
    const res = await r.fetch();
    const json = await res.json();
    await r.fulfill({ response: res, json: { ...json, masked: true } });
  });
  await page.route("**/data/v1/masked.json", (r) => {
    const json = loadFixture(state);
    edit?.(json);
    return r.fulfill({ json });
  });
}
