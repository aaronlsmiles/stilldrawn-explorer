// break-ui: the realistic worst case for every view (test-only; nothing here ships).
// Real extremes come from the published data itself, reached by deep links; states the data
// can't produce (crowd sizes, failures) enter at the data boundary through route overrides.
// SHOTS_DIR=<dir> also saves a screenshot of each state.
import { test as base, expect, type Page } from "@playwright/test";
import { test, isPhone } from "./fixtures";
import { runSession, seedSession, study } from "./rateFlow";
import { withMasked, type MaskedJson, type MaskedState } from "./maskedFixtures";

const shot = async (page: Page, name: string, project: string) => {
  if (!process.env.SHOTS_DIR) return;
  await page.evaluate(() => { scrollTo(0, 0); return document.fonts.ready; });
  await page.screenshot({ path: `${process.env.SHOTS_DIR}/${project}/${name}.png`, fullPage: true });
};
/** Nothing wider than the viewport, nothing wider than its panel. */
async function fits(page: Page, what: string) {
  const r = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    spilled: [...document.querySelectorAll(".panel, .bp-screen, .bp-results")].filter((e) => e.scrollWidth > e.clientWidth + 1)
      .map((e) => `${e.className.split(" ").slice(0, 3).join(".")} ${e.scrollWidth}>${e.clientWidth}`),
  }));
  expect.soft(r.doc, `${what}: page width`).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect.soft(r.spilled, `${what}: content wider than its panel`).toEqual([]);
}
const WIDTHS = [320, 720];   // the narrowest phone; 1440 at 200 % zoom

// The dataset's own extremes
const EXTREMES: [string, string][] = [
  ["longest panel id (21 chars), ground arm", "/explore?arm=ground"],
  ["largest drift in the release (103.1 px) against Wan 2.2", "/explore?cell=cu-line-1_idle&e=h3-fal&vs=wan22"],
  ["ten draws on one cell; screentone 5.1e-9 on a hazard draw", "/explore?cell=act-black-3_idle&e=h3-fal&draw=h9"],
  ["the release's largest clip (26.8 MB)", "/explore?cell=act-tone-3_idle&e=gen4.5"],
  ["the one cell never generated", "/explore?cell=cu-tone-3_idle&e=gen4_turbo"],
  ["a scout clip (Seedance), not analysed", "/explore?arm=seedance"],
  ["every arm on the scatter, style drift", "/scatter?arms=repeat,hazard,ground,seedance&y=style"],
  ["the price at its maximum", "/tax?p=3"],
  ["a band so narrow no engine ranks", "/tax?lens=band&lo=0.0101&hi=0.0102"],
];

for (const [what, u] of EXTREMES) {
  test(`extreme: ${what}`, async ({ page }, info) => {
    await page.goto(u);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForTimeout(400);
    await fits(page, what);
    await shot(page, `x-${what.split(/[ ,(]/)[0]}-${u.length}`, info.project.name);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(200);
      await fits(page, `${what} @${w}`);
    }
  });
}

// The crowd and the opt-in: states only a live tally produces
const tally = (n: number, per: number) => ({
  study: study.id, n_sessions: n,
  items: Object.fromEntries(study.parts.clips.items.map((i: { code: string }, k: number) => [i.code, {
    register: { n: per, counts: [k % 5, 1, 2, per - 6 - (k % 5), 3].map((x) => Math.max(0, x)) },
    sameness: { n: per, counts: [0, 2, 3, 4, per - 9] },
  }])),
});
const RATE_STATES: { name: string; tally?: (r: import("@playwright/test").Route) => Promise<void>; submit?: number; answers?: number }[] = [
  { name: "one visitor so far", tally: (r) => r.fulfill({ json: { study: study.id, n_sessions: 1, items: {} } }) },
  { name: "1,284 visitors, every clip past the threshold", tally: (r) => r.fulfill({ json: tally(1284, 64) }) },
  { name: "tally down", tally: (r) => r.fulfill({ status: 503, body: "" }) },
  { name: "already added (409)", submit: 409 },
  { name: "tally full for today (429)", submit: 429 },
  { name: "submit fails (500)", submit: 500 },
  { name: "every answer a 3 (no spread, ρ undefined)", answers: 3 },
];

for (const st of RATE_STATES) {
  base(`rate: ${st.name}`, async ({ page }, info) => {
    base.setTimeout(150_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route((u) => u.pathname === "/api/tally", st.tally ?? ((r) => r.fulfill({ json: { study: study.id, n_sessions: 0, items: {} } })));
    await page.route("**/api/submit", (r) => r.fulfill({ status: st.submit ?? 200, json: { ok: (st.submit ?? 200) === 200 } }));
    await seedSession(page, "0f0e0d0c-0b0a-4908-8706-050403020100");
    await page.goto("/rate");
    await runSession(page, st.answers ? { answers: st.answers } : {});
    await page.getByRole("button", { name: "See where you land" }).click();
    await expect(page.getByRole("heading", { name: "Where you land" })).toBeVisible();
    if (st.submit) {
      await page.getByRole("button", { name: "Add my ratings to the public tally" }).click();
      await expect(page.locator(".bp-status")).not.toHaveText(/Sending|^$/);
    }
    await expect(page.locator(".bp-crowd")).not.toContainText("Loading");
    if (st.name.startsWith("1,284")) await expect(page.locator(".bp-crowd")).toContainText("1,284 visitors have added");
    if (st.name.startsWith("one visitor")) await expect(page.locator(".bp-crowd")).toContainText("1 visitor has added");
    await fits(page, st.name);
    expect(errors).toEqual([]);
    for (const n of await page.locator(".bp-results").allTextContents()) expect(n).not.toMatch(/NaN|undefined|Infinity|null/);
    await shot(page, `rate-${st.name.split(/[ ,(]/)[0]}-${st.name.length}`, info.project.name);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(200);
      await fits(page, `${st.name} @${w}`);
    }
  });
}

// Failures at the data boundary: each view says what failed, in the page's own frame
base("the data fails to load: one honest message and a retry, and no refetch loop", async ({ page }, info) => {
  let n = 0;
  await page.route("**/data/v1/clips.json", (r) => { n++; return r.fulfill({ status: 500, body: "" }); });
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Couldn't load the data" })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(n, "clips.json requests after one failure").toBeLessThanOrEqual(2);   // was 1,779 in 3 s
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await fits(page, "data error");
  await shot(page, "err-data", info.project.name);
});

base("the rating study fails to load: the page keeps its frame and says so in words", async ({ page }, info) => {
  await page.route("**/data/blindpanel/stilldrawn/study.json", (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto("/rate");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).not.toContainText("HTTP");
  await expect(page.getByRole("banner")).toBeVisible();   // the top bar stays
  await shot(page, "err-study", info.project.name);
});

base("the reveal fails after the last clip: answers kept, a way to retry", async ({ page }, info) => {
  base.setTimeout(150_000);
  await page.route("**/reveal.json", (r) => r.fulfill({ status: 500, body: "" }));
  await page.route((u) => u.pathname === "/api/tally", (r) => r.fulfill({ json: { study: study.id, n_sessions: 0, items: {} } }));
  await seedSession(page, "0f0e0d0c-0b0a-4908-8706-050403020101");
  await page.goto("/rate");
  await runSession(page);
  await page.getByRole("button", { name: "See where you land" }).click();
  await expect(page.getByRole("alert")).toContainText("Your answers are kept");
  await shot(page, "err-reveal", info.project.name);
});

base("a per-frame series fails: the curve panel says so, the rest of the clip stays", async ({ page }, info) => {
  let n = 0;
  await page.route("**/data/v1/series/gen4.5.json", (r) => { n++; return r.fulfill({ status: 500, body: "" }); });
  await page.goto("/explore?cell=act-tone-2_campush&e=gen4.5");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("act-tone-2");
  await expect(page.locator(".curve-panel [role=alert]")).toContainText("per-frame");
  await expect(page.getByTestId("readouts")).toBeVisible();
  await page.waitForTimeout(1000);
  expect(n).toBeLessThanOrEqual(2);
  await shot(page, "err-series", info.project.name);
});

base("the media host is down: the player says so plainly", async ({ page }, info) => {
  await page.route(/media\.studionephele\.com\/.*\.(mp4|webp|png)$/, (r) => r.abort());
  await page.goto("/explore?cell=act-tone-2_campush&e=gen4.5");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const cap = page.getByTestId("clip-a").locator("figcaption");
  await expect(cap).not.toContainText("once the media host is live");
  await fits(page, "media down");
  await shot(page, "err-media", info.project.name);
});

test("phone: the ten-draw cell's draw switch fills its rows", async ({ page }) => {
  test.skip(!isPhone(page), "phones only");
  await page.goto("/explore?cell=act-black-3_burst&e=h3-fal");
  const opts = page.locator('fieldset.seg:has(legend:text("Draw")) .seg-opt');
  await expect(opts.first()).toBeVisible();
  const rows = await opts.evaluateAll((os) => {
    const byTop = new Map<number, number>();
    for (const o of os) { const r = o.getBoundingClientRect(); byTop.set(Math.round(r.top), (byTop.get(Math.round(r.top)) ?? 0) + r.width); }
    return [...byTop.values()];
  });
  const track = await page.locator('fieldset.seg:has(legend:text("Draw")) .seg-track').evaluate((t) => t.clientWidth);
  for (const w of rows) expect(w).toBeGreaterThan(track - 4);
});

// ---------------------------------------------------------------------------------------------
// /tax/masked worst cases (P46 D13): each case edits the synthetic fixture at the data boundary.
const WHOLE_PANEL = [[[0, 0], [1, 0], [1, 1], [0, 1]]];
const EVERY_COND = (j: MaskedJson, f: (c: MaskedJson, split: string, set: string, mk: string) => void) => {
  for (const [split, sets] of Object.entries(j.test2.conditions)) for (const [set, mgs] of Object.entries(sets as MaskedJson))
    for (const [mk, c] of Object.entries(mgs as MaskedJson)) f(c, split, set, mk);
};
type MaskedCase = {
  name: string; url?: string; state?: MaskedState; edit?: (j: MaskedJson) => void;
  routes?: (page: Page) => Promise<void>; check?: (page: Page) => Promise<void>;
};
const LONG_ENGINE = "Engine-with-a-name-that-never-ever-breaks";   // 41 chars, no space
const LONG_ROW = "a-panel-id-that-is-really-quite-extraordinarily-long-indeed_idle";   // 63 chars
const MASKED_WORST: MaskedCase[] = [
  {
    name: "an engine with no masked value (infinite drift): no line, 'no value', the undefined-gap headline",
    url: "/tax/masked?row=act-black-2_idle",
    edit: (j) => {
      j.test2.verdict = "not supported";        // with s undefined the page must not claim "supported"
      EVERY_COND(j, (c) => {
        c.D_masked_px["gen4.5"] = null; c.ratio_masked = null; c.s = null; c.s_ci95 = null;
        c.n_unscorable_masked["gen4.5"] = c.n_clips["gen4.5"];
      });
      for (const r of j.rows) for (const set of ["aaron", "agent"]) for (const mk of ["m16", "m32", "m64"]) {
        const c = r.clips["gen4.5"]; if (c) Object.assign(c.masked[set][mk], { px: null, unscorable: true });
      }
    },
    check: async (page) => {
      await expect(page.locator('[data-testid="league-row"][data-engine="gen4.5"]')).toContainText("no value");
      await expect(page.getByTestId("headline").first()).toContainText("undefined");
      await expect(page.locator('.masked-chart g.eng[data-engine="gen4.5"] line.slope')).toHaveCount(0);
      await expect(page.locator('.masked-chart g.eng[data-engine="wan22"] line.slope')).toHaveCount(1);
      await expect(page.locator('[data-testid="mk-engine"][data-engine="gen4.5"]')).toContainText("no value");
    },
  },
  {
    name: "an engine with no clips in a split",
    url: "/tax/masked?split=burst",
    edit: (j) => EVERY_COND(j, (c, split) => {
      if (split !== "burst") return;
      c.n_clips["h3-fal"] = 0; c.D_whole_px["h3-fal"] = null; c.D_masked_px["h3-fal"] = null;
    }),
    check: async (page) => {
      const row = page.locator('[data-testid="league-row"][data-engine="h3-fal"]');
      await expect(row.locator("td.num").first()).toHaveText("0");
      await expect(row).toContainText("no value");
    },
  },
  {
    name: "every row ineligible but one",
    url: "/tax/masked?row=est-line-1_idle",
    edit: (j) => { for (const r of j.rows) r.eligible = r.row === "est-line-2_burst"; },
    check: async (page) => {
      await expect(page.locator('[data-testid="mk-tile"][data-eligible="false"]')).toHaveCount(21);
      await expect(page.getByRole("region", { name: /est-line-1 idle, left out/ })).toContainText(/left out of Test 2/);
      await expect(page.getByTestId("mk-engine")).toHaveCount(0);
    },
  },
  {
    name: "a 'nothing may move' mask: the whole frame is measured, and the detail says so",
    url: "/tax/masked?row=chain-est-cosmic-1_burst",
    check: async (page) => {
      const d = page.getByRole("region", { name: /chain-est-cosmic-1 burst, by engine/ });
      await expect(d).toContainText("Nothing may move here, so the whole frame is measured");
      await expect(d.locator("path.mk-allowed")).toHaveCount(0);
      await expect(d.locator("rect.mk-shade").first()).toBeVisible();
    },
  },
  {
    name: "a whole-panel mask: nothing left to measure",
    url: "/tax/masked?row=cu-black-2_idle",
    edit: (j) => { const r = j.rows.find((x: MaskedJson) => x.row === "cu-black-2_idle"); r.polygons.aaron = WHOLE_PANEL; r.status.aaron = "drawn"; },
    check: async (page) => {
      await expect(page.locator('[data-testid="mk-tile"][data-row="cu-black-2_idle"]')).toContainText("Nothing left to measure");
      await expect(page.getByRole("region", { name: /cu-black-2 idle, by engine/ })).toContainText("Nothing left to measure");
    },
  },
  {
    name: "long names: a 41-character engine, a 63-character row",
    url: `/tax/masked?row=${LONG_ROW}`,
    edit: (j) => { const r = j.rows[0]; r.row = LONG_ROW; r.panel = LONG_ROW.replace("_idle", ""); },
    routes: async (page) => {
      await page.route("**/data/v1/engines.json", async (r) => {
        const res = await r.fetch(), json = await res.json();
        for (const e of json) if (e.id === "gen4.5") e.name = LONG_ENGINE;
        await r.fulfill({ response: res, json });
      });
    },
    check: async (page) => {
      await expect(page.locator('[data-testid="league-row"][data-engine="gen4.5"] button')).toHaveAttribute("title", LONG_ENGINE);
      await expect(page.locator('[data-testid="mk-tile"]').first()).toHaveAttribute("data-row", LONG_ROW);
      await expect(page.locator('[data-testid="mk-tile"] .mk-name').first()).toHaveAttribute("title", LONG_ROW);
      // every chart label sits inside its chart
      const outside = await page.locator("svg").evaluateAll((svgs) => svgs.flatMap((svg) => {
        const b = svg.getBoundingClientRect();
        return [...svg.querySelectorAll("text")].map((t) => [t.textContent, t.getBoundingClientRect()] as const)
          .filter(([, r]) => r.width && (r.left < b.left - 1 || r.right > b.right + 1)).map(([t]) => t);
      }));
      expect(outside, "chart labels outside their chart").toEqual([]);
    },
  },
  {
    name: "extreme numbers: 1e6 and 0.0000012 px medians, s of -3.4, a CI without ends, no tau",
    edit: (j) => { j.test2.verdict = "not supported"; EVERY_COND(j, (c) => {       // s of -3.4 is not "supported"
      c.D_whole_px["h3-fal"] = 1e6; c.D_masked_px["h3-fal"] = 1.2e-6; c.D_masked_px["wan22"] = 0.0000012;
      c.s = -3.4; c.s_ci95 = [null, null]; c.kendall_tau_b = null;
    }); },
    check: async (page) => {
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/\de[+-]?\d/i);   // no exponent notation
      expect(text).toContain("0.0000012 px");     // a tiny value is not rounded to 0.00
      expect(text).toContain("1000000.00 px");
      await expect(page.getByTestId("headline").first()).toContainText("s = \u22123.40");
    },
  },
  {
    name: "Test 1 extremes: rates 0 and 1, interval 0 to 1, no kappa, a null p, a partial note",
    state: "two-rater",
    edit: (j) => {
      const t = j.test1;
      for (const [id, rate] of [["AARON", 0], ["R7", 1]] as const) {
        for (const x of Object.values(t.raters[id].primary.per_engine) as MaskedJson[]) {
          x.miss_rate = rate; x.misses = rate ? x.n : 0; x.wilson95 = [0, 1];
        }
      }
      Object.assign(t.raters.R7.primary, { rho: null, p_one_sided: null, p_le_0_05: false });
      t.verdict = "not supported"; t.kappa = { burst: null, push: null };
      t.partial_note = "R7 rated 31 of 44 clips before the deadline, so the second rater's statistic is partial and read with that in mind throughout this page.";
    },
    check: async (page) => {
      await expect(page.locator(".mk-test1")).toContainText("R7 rated 31 of 44");
      await expect(page.locator(".mk-rater")).toHaveCount(2);
    },
  },
  {
    name: "phone: the gallery is two columns and the posters wrap",
    url: "/tax/masked?row=act-black-2_idle",
    check: async (page) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.waitForTimeout(200);
      const lefts = await page.getByTestId("mk-tile").evaluateAll((ts) => [...new Set(ts.map((t) => Math.round(t.getBoundingClientRect().left)))]);
      expect(lefts, "gallery columns at 320").toHaveLength(2);
      const tops = await page.getByTestId("mk-engine").evaluateAll((es) => [...new Set(es.map((e) => Math.round(e.getBoundingClientRect().top)))]);
      expect(tops.length, "posters wrap onto more than one row").toBeGreaterThan(1);
    },
  },
];

// the undefined-gap headline is the registered wording and says "undefined" on purpose; every other word is scanned
const SCAN = /NaN|undefined|Infinity|null/;
const scanned = (page: Page) => page.locator("main").innerText().then((t) => t.replace(/the Gen-4\.5\/Wan ratio is undefined/g, ""));
for (const c of MASKED_WORST) {
  test(`masked: ${c.name}`, async ({ page }, info) => {
    await withMasked(page, c.state ?? "pending", c.edit);
    await c.routes?.(page);
    await page.goto(c.url ?? "/tax/masked");
    await expect(page.getByTestId("headline").first()).toBeVisible();
    await page.waitForTimeout(400);
    await c.check?.(page);
    expect(await scanned(page), "page text").not.toMatch(SCAN);
    await shot(page, `masked-${c.name.split(/[ ,:(']/)[0]}-${c.name.length}`, info.project.name);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(250);
      await fits(page, `${c.name} @${w}`);
      expect(await scanned(page), `page text @${w}`).not.toMatch(SCAN);
    }
  });
}
