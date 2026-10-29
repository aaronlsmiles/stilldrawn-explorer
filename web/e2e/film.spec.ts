// The films' capture (spec: docs/superpowers/specs/2026-10-29-films-design.md). Each test records one or more
// beats into film/capture/<film>/<aspect>/<beat>/ for film/build/edit.py. Run with e2e/film.config.ts.
// Marks in events.json say what is on screen ("clip": the engines whose clips play), so credits follow it.
import { test, expect, type Page, type TestInfo, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Recorder } from "./film/recorder";
import { addPointer } from "./film/pointer";
import { guardApi } from "./film/guard";
import { SLOW, scrollGlide, slowAnimations, slowMedia, wait } from "./film/slow";
import { panelMean, seedSession, study } from "./rateFlow";

const CAPTURE = fileURLToPath(new URL("../../film/capture/", import.meta.url));
const BUILD = new URL("../../film/build/", import.meta.url);
const reveal = JSON.parse(readFileSync(new URL("../public/data/blindpanel/stilldrawn/reveal.json", import.meta.url), "utf8"));
const codeByVideo = new Map<string, string>(study.parts.clips.items.map((i: { code: string; video: string }) => [i.video, i.code]));

const isPhone = (info: TestInfo) => info.project.name === "film-phone";
const aspect = (info: TestInfo) => (isPhone(info) ? "9x16" : "16x9");
const rec = (page: Page, info: TestInfo, film: string, beat: string) => new Recorder(page, `${CAPTURE}${film}/${aspect(info)}/${beat}`);
const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

let pos: [number, number] = [0, 0];

async function setup(page: Page, info: TestInfo, start: [number, number] = [720, 420]) {
  const noApi = await guardApi(page);
  await addPointer(page, isPhone(info));
  await slowMedia(page);
  pos = start;
  return noApi;
}

/** Moves the mouse along an eased path at about 60 steps a second (the cursor is drawn from these events). */
async function glide(page: Page, x: number, y: number, ms: number) {
  const [x0, y0] = pos;
  const n = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) {
    const u = ease(i / n);
    await page.mouse.move(x0 + (x - x0) * u, y0 + (y - y0) * u);
    await wait(page, ms / n);
  }
  pos = [x, y];
}

async function center(l: Locator) {
  const b = (await l.boundingBox())!;
  return [b.x + b.width / 2, b.y + b.height / 2] as [number, number];
}

/** A visible press: the mouse glides there and clicks (desktop), or a finger taps it (phone). */
async function press(page: Page, info: TestInfo, l: Locator, ms = 700) {
  // out of view: an eased scroll that brings it to the lower third (a jump would read as a cut)
  const b = (await l.boundingBox())!, vh = page.viewportSize()!.height;
  if (b.y < 56 || b.y + b.height > vh - 8) await scrollGlide(page, (await page.evaluate(() => scrollY)) + b.y - vh * 0.62, 500);
  const [x, y] = await center(l);
  if (isPhone(info)) {
    await page.touchscreen.tap(x, y);
  } else {
    await glide(page, x, y, ms);
    await page.mouse.down(); await wait(page, 90); await page.mouse.up();
  }
}

/** A drag along `pts` ([x, y, ms to reach it]) by mouse or by touch, calling `each` after every step. */
async function drag(page: Page, info: TestInfo, pts: [number, number, number][], each?: () => Promise<void>) {
  const steps: [number, number][] = [];
  let [x0, y0] = [pts[0][0], pts[0][1]];
  for (const [x, y, ms] of pts.slice(1)) {
    const n = Math.max(2, Math.round(ms / 33));
    for (let i = 1; i <= n; i++) steps.push([x0 + ((x - x0) * i) / n, y0 + ((y - y0) * i) / n]);
    [x0, y0] = [x, y];
  }
  const dt = pts.slice(1).reduce((a, p) => a + p[2], 0) / steps.length;
  if (isPhone(info)) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, p?: [number, number]) =>
      cdp.send("Input.dispatchTouchEvent", { type: type as "touchStart", touchPoints: p ? [{ x: p[0], y: p[1] }] : [] });
    await touch("touchStart", [pts[0][0], pts[0][1]]);
    for (const p of steps) { await wait(page, dt); await touch("touchMove", p); if (each) await each(); }
    await touch("touchEnd");
    await cdp.detach();
  } else {
    await glide(page, pts[0][0], pts[0][1], 500);
    await page.mouse.down();
    for (const p of steps) { await wait(page, dt); await page.mouse.move(p[0], p[1]); if (each) await each(); }
    await page.mouse.up();
    pos = steps.at(-1)!;
  }
}

const smoothScroll = (page: Page, top: number, ms = 900) => scrollGlide(page, top, ms);
const ready = (page: Page) => page.evaluate(() => document.fonts.ready.then(() => true));
const playing = (page: Page) =>
  page.waitForFunction(() => { const v = [...document.querySelectorAll("video")]; return v.length > 0 && v.every((x) => x.readyState >= 3 && !x.paused); }, null, { timeout: 60_000 });

/** Marks "clip" whenever the set of engines whose clips are in view changes (from each video's aria-label,
 *  "<engine> clip <id>, muted"), so the edit's credit chip follows what is on screen. */
function track(page: Page, r: Recorder) {
  let on = true, last = "";
  const loop = (async () => {
    while (on) {
      const names = await page.locator("video").evaluateAll((vs) => vs.filter((v) => {
        const b = v.getBoundingClientRect();
        return b.width > 0 && b.bottom > 8 && b.top < innerHeight - 8;
      }).map((v) => (v.getAttribute("aria-label") ?? "").split(" clip ")[0])).catch(() => [] as string[]);
      const k = names.join("|");
      if (k !== last) { r.mark("clip", { names }); last = k; }
      await page.waitForTimeout(150);
    }
  })();
  return async () => { on = false; await loop; };
}

// ---------- P01 ----------

test("p01-hook", async ({ page }, info) => {
  const noApi = await setup(page, info, [1380, 560]);
  await page.goto("/explore");
  await slowAnimations(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wan 2.2");
  await ready(page);
  const r = rec(page, info, "p01", "hook");
  if (isPhone(info)) {
    // phones wait for a tap on clips over 10 MB: the source, both clips and the play button in frame
    await page.evaluate(() => scrollTo(0, (document.querySelectorAll("video")[0] as HTMLElement).getBoundingClientRect().top + scrollY - 280));
    await r.start();
    const untrack = track(page, r);
    await wait(page, 700);
    await press(page, info, page.getByRole("button", { name: /^Play/ }));
    await playing(page);
    await wait(page, 7000);
    await untrack();
  } else {
    await page.mouse.move(...pos);
    await playing(page);
    await r.start();
    const untrack = track(page, r);
    await wait(page, 8000);
    await untrack();
  }
  console.log(info.title, info.project.name, await r.stop());
  noApi();
});

test("p01-interaction", async ({ page }, info) => {
  test.setTimeout(900_000);
  const noApi = await setup(page, info, [760, 420]);
  await page.goto("/explore");
  await slowAnimations(page);
  await ready(page);
  const r = rec(page, info, "p01", "interaction");
  const pickName = /^est-line-1, Idle, Gen-4\.5/;
  if (isPhone(info)) {
    await r.start();
    const untrack = track(page, r);
    await wait(page, 500);
    await press(page, info, page.getByRole("link", { name: "All cells" }).or(page.getByRole("button", { name: "All cells" })).first());
    const row = page.getByTestId("panel-row").filter({ hasText: /^est-line-1/ }).getByRole("button");
    await wait(page, 500);
    const y = (await row.boundingBox())!.y;
    await smoothScroll(page, y + (await page.evaluate(() => scrollY)) - 220, 1400);
    await press(page, info, row);
    r.mark("pick");
    await wait(page, 600);
    const tab = page.getByRole("radio", { name: "Gen-4.5", exact: true }).or(page.getByRole("button", { name: "Gen-4.5", exact: true })).first();
    if (!(await page.getByRole("heading", { level: 1 }).textContent())?.includes("Gen-4.5")) await press(page, info, tab);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("est-line-1");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Gen-4.5");
    // the pick keeps the list's scroll position: show the heading and finding first
    await scrollGlide(page, 0, 900);
    await wait(page, 1600);
    const video = page.locator("video").first();
    await smoothScroll(page, (await video.boundingBox())!.y + (await page.evaluate(() => scrollY)) - 150, 900);
    const play = page.getByRole("button", { name: /^Play/ });
    if (await play.isVisible()) await press(page, info, play);
    await playing(page);
    await wait(page, 2500);
    const curve = page.locator(".curve");
    await smoothScroll(page, (await curve.boundingBox())!.y + (await page.evaluate(() => scrollY)) - 200, 1100);
    const b = (await curve.boundingBox())!;
    const yy = b.y + b.height * 0.45;
    r.mark("scrub-start");
    await drag(page, info, [[b.x + b.width * 0.15, yy, 0], [b.x + b.width * 0.85, yy, 2600], [b.x + b.width * 0.45, yy, 1500]]);
    r.mark("scrub-end");
    await wait(page, 1200);
    await smoothScroll(page, (await video.boundingBox())!.y + (await page.evaluate(() => scrollY)) - 150, 1100);
    const diff = page.getByRole("button", { name: "Difference" });
    await press(page, info, diff);
    r.mark("diff-on");
    if (await play.isVisible()) await press(page, info, play);
    await wait(page, 3500);
    await untrack();
  } else {
    await page.mouse.move(...pos);
    await r.start();
    const untrack = track(page, r);
    await wait(page, 600);
    const cell = page.getByRole("button", { name: pickName });
    // bring the row into view: the page scrolls; the detail pane is sticky
    const y = (await cell.boundingBox())!.y;
    await smoothScroll(page, y + (await page.evaluate(() => scrollY)) - 360, 1300);
    await press(page, info, cell, 900);
    r.mark("pick");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("est-line-1");
    await playing(page);
    // the detail pane scrolls on its own: the clip and the curve both in frame
    const paneTop = await page.locator(".detail-pane").evaluate((el) => (el.querySelector("video") as HTMLElement).getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 54);
    await scrollGlide(page, paneTop, 1100, ".detail-pane");
    await wait(page, 1500);
    const curve = page.locator(".curve");
    const b = (await curve.boundingBox())!;
    const yy = b.y + b.height * 0.45;
    r.mark("scrub-start");
    await drag(page, info, [[b.x + b.width * 0.12, yy, 0], [b.x + b.width * 0.9, yy, 2800], [b.x + b.width * 0.5, yy, 1600]]);
    r.mark("scrub-end");
    await wait(page, 900);
    const play = page.getByRole("button", { name: /^Play/ });
    if (await play.isVisible()) { await press(page, info, play); }
    await wait(page, 600);
    await press(page, info, page.getByRole("button", { name: "Difference" }));
    r.mark("diff-on");
    await wait(page, 3800);
    await untrack();
  }
  console.log(info.title, info.project.name, await r.stop());
  noApi();
});

test("p01-scatter", async ({ page }, info) => {
  const noApi = await setup(page, info, [1100, 600]);
  await page.goto("/scatter");
  await slowAnimations(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await ready(page);
  const r = rec(page, info, "p01", "scatter");
  if (isPhone(info)) {
    await page.evaluate(() => scrollTo(0, (document.querySelector("h1") as HTMLElement).getBoundingClientRect().top + scrollY - 16));
    await r.start();
    await wait(page, 2500);
    const svg = page.locator("svg.plot, .scatter svg, svg").filter({ has: page.locator("circle") }).first();
    await smoothScroll(page, (await svg.boundingBox())!.y + (await page.evaluate(() => scrollY)) - 120, 1200);
    await wait(page, 4000);
  } else {
    await page.mouse.move(...pos);
    await r.start();
    await wait(page, 1500);
    await press(page, info, page.getByRole("radio", { name: "Gen-4.5" }), 900);
    r.mark("highlight", { engine: "gen4.5" });
    await wait(page, 2600);
    await press(page, info, page.getByRole("radio", { name: "Wan 2.2" }), 700);
    r.mark("highlight", { engine: "wan22" });
    await wait(page, 2600);
  }
  console.log(info.title, info.project.name, await r.stop());
  noApi();
});

test("p01-tax", async ({ page }, info) => {
  const noApi = await setup(page, info, [900, 300]);
  await page.goto("/tax");
  await slowAnimations(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stillness Tax");
  await ready(page);
  const slider = page.locator("input[type=range]").first();
  if (isPhone(info)) await page.evaluate(() => scrollTo(0, (document.querySelector(".slider") as HTMLElement).getBoundingClientRect().top + scrollY - 56)); // under the 48 px top bar
  else await page.mouse.move(...pos);
  const b = (await slider.boundingBox())!;
  const max = Number(await slider.getAttribute("max"));
  const at = (p: number): [number, number] => [b.x + 8 + (p / max) * (b.width - 16), b.y + b.height / 2];
  const r = rec(page, info, "p01", "tax");
  await r.start();
  let last = "";
  const read = async () => {
    const [p, leader] = await Promise.all([slider.inputValue(), page.getByTestId("board-row").first().getAttribute("data-engine")]);
    if (leader !== last) { r.mark("leader", { engine: leader, p: Number(p) }); last = leader!; }
  };
  await read();
  await wait(page, 2200);
  const [x0, y0] = at(0);
  r.mark("drag-start");
  await drag(page, info, [[x0, y0, 0], [...at(1.1), 2200], [...at(1.42), 5200], [...at(1.42), 1200], [...at(2.2), 1600]], read);
  r.mark("drag-end", { p: Number(await slider.inputValue()) });
  await wait(page, 3500);
  console.log(info.title, info.project.name, await r.stop());
  noApi();
});

// ---------- P10 ----------

/** A seeded visitor: the panel's rounded mean plus a fixed offset (-1, 0, 0 or +1), kept inside 1–5. */
function visitor(seed = 20261029) {
  let s = seed >>> 0;
  const next = () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; return s / 2 ** 32; };
  const off = () => [-1, 0, 0, 1][Math.floor(next() * 4)];
  return {
    still: () => (next() < 0.7 ? 5 : 4),
    clip: (code: string) => (["register", "sameness"] as const).map((q) => Math.min(5, Math.max(1, panelMean(q, code) + off()))),
  };
}

test("p10-rate", async ({ page }, info) => {
  test.setTimeout(1_200_000);
  const noApi = await setup(page, info, [700, 500]);
  await seedSession(page, "0b6f3c2e-9a41-4d7e-b5c8-2f1e6a9d4c37");
  await page.goto("/rate");
  await slowAnimations(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rate it yourself");
  await ready(page);
  if (!isPhone(info)) await page.mouse.move(...pos);
  const v = visitor();
  const session = page.locator('[data-bp="session"]');
  const heading = session.getByRole("heading", { level: 2 });
  const r = rec(page, info, "p10", "session");
  await r.start();
  r.mark("screen", { kind: "intro" });
  await wait(page, 900);
  await press(page, info, session.getByRole("button", { name: "Start" }));
  for (;;) {
    await expect(heading).not.toHaveText(study.title);
    const h = (await heading.textContent()) ?? "";
    if (h.startsWith("Done")) break;
    const sets = session.locator("fieldset");
    let keys: number[];
    if (h.startsWith("Still")) {
      await expect(session.locator(".bp-still img")).toHaveJSProperty("complete", true);
      r.mark("screen", { kind: "still", h });
      keys = [v.still()];
      await wait(page, 250);
    } else {
      const code = codeByVideo.get((await session.locator("video").getAttribute("src")) ?? "")!;
      const it = reveal.items[code];
      r.mark("screen", { kind: "clip", h, code });
      r.mark("clip", { names: [it.label] });
      await page.waitForFunction(() => { const x = document.querySelector('[data-bp="session"] video') as HTMLVideoElement | null; return !!x && x.readyState >= 3; }, null, { timeout: 60_000 });
      await wait(page, 1300);
      keys = v.clip(code);
    }
    for (const [i, k] of keys.entries()) {
      await press(page, info, sets.nth(i).getByRole("radio", { name: new RegExp(`^${k},`) }), 380);
      await wait(page, 150);
    }
    await press(page, info, session.getByRole("button", { name: "Next" }), 380);
    await expect(heading).not.toHaveText(h);
    r.mark("clip", { names: [] });
  }
  r.mark("screen", { kind: "done" });
  await wait(page, 1200);
  console.log(info.title, "session", info.project.name, await r.stop());

  const r2 = rec(page, info, "p10", "results");
  await r2.start();
  await wait(page, 600);
  await press(page, info, page.getByRole("button", { name: "See where you land" }));
  await expect(page.getByRole("heading", { name: "Where you land" })).toBeVisible();
  r2.mark("results");
  await wait(page, 2500);
  const h2 = page.getByRole("heading", { name: "Where you land" });
  const top = (await h2.boundingBox())!.y + (await page.evaluate(() => scrollY)) - 80;
  for (const k of [0, 1, 2, 3]) {
    await smoothScroll(page, top + k * (isPhone(info) ? 420 : 520), 1500);
    await wait(page, 1300);
  }
  console.log(info.title, "results", info.project.name, await r2.stop());
  await expect(page.getByRole("button", { name: /Add my ratings/ })).toBeVisible(); // offered, never pressed
  noApi();
});

test("p10-terminal", async ({ page }, info) => {
  const transcript = JSON.parse(readFileSync(new URL("setup-transcript.json", BUILD), "utf8"));
  await page.goto(new URL("terminal.html", BUILD).href);
  await slowAnimations(page);
  await page.waitForSelector("body[data-ready]");
  const r = rec(page, info, "p10", "terminal");
  await r.start();
  await page.evaluate(([t, o]) => (window as unknown as { play: (t: unknown, o: unknown) => Promise<void> }).play(t, { scale: o }), [transcript, SLOW] as const);
  r.mark("done");
  await wait(page, 3500);
  console.log(info.title, info.project.name, await r.stop());
});
