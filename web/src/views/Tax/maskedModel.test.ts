// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Masked, MaskedCondition } from "../../data/types";
import { pairVerdict } from "../../test/pairVerdict";
import {
  DEFAULT_STATE, VERDICT_LINES, condOf, frameMask, galleryStroke, gridFor, headline, headlineViews, leagueRows, marginStroke, panelMapper, parseState,
  r7Note, regionPath, regionState, fitLabel, pxr, slope, stateToQuery, test1View, verdictFor, viewStatus,
} from "./maskedModel";

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./__fixtures__/masked-${n}.json`, import.meta.url), "utf8")) as Masked;
const paper = JSON.parse(readFileSync(new URL("../../../public/data/v1/paper.json", import.meta.url), "utf8"));
const STATES = ["pending", "two-rater", "fallback", "fallback-late"] as const;
const NAMES: Record<string, string> = { wan22: "Wan 2.2", gen4_turbo: "Gen-4 Turbo", ltx23: "LTX-2.3", "gen4.5": "Gen-4.5", "h3-fal": "MiniMax H3" };
const name = (e: string) => NAMES[e];
const FORBIDDEN = /doubling|log2|log₂|2\.6|rank/i;

describe("state", () => {
  it("defaults, and falls back on bad values", () => {
    expect(parseState(new URLSearchParams())).toEqual({ masks: "aaron", margin: 32, split: "all", row: null, table: false });
    expect(parseState(new URLSearchParams("masks=x&margin=7&split=nope&table=yes"))).toEqual(DEFAULT_STATE);
  });
  it("keeps a default link bare and round-trips the rest", () => {
    expect(stateToQuery(DEFAULT_STATE)).toEqual({});
    const q = "masks=agent&margin=64&split=burst&row=act-black-2_idle&table=1";
    const s = parseState(new URLSearchParams(q));
    expect(s).toEqual({ masks: "agent", margin: 64, split: "burst", row: "act-black-2_idle", table: true });
    expect(new URLSearchParams(stateToQuery(s) as Record<string, string>).toString()).toBe(new URLSearchParams(q).toString());
  });
});

describe.each(STATES)("league rows (%s)", (st) => {
  const m = fx(st);
  const cond = condOf(m, DEFAULT_STATE);
  it("follows engine_order, which is the frozen league order", () => {
    const rows = leagueRows(m, cond, name);
    expect(rows.map((r) => r.engine)).toEqual(m.engine_order);
    const league = Object.entries(paper.league_drift_median_px.value as Record<string, number>).sort((a, b) => a[1] - b[1]).map(([e]) => e);
    expect(m.engine_order).toEqual(league);
  });
  it("has no rank anywhere and always pairs masked with whole-frame", () => {
    for (const r of leagueRows(m, cond, name)) {
      expect(Object.keys(r).sort()).toEqual(["engine", "masked", "n", "name", "note", "whole"]);
      expect(JSON.stringify(r)).not.toMatch(/rank/i);
      expect(r.whole).toBe(cond.D_whole_px[r.engine]);
      expect(r.masked).toBe(cond.D_masked_px[r.engine]);
    }
  });
});

it("a null masked median is 'no value'", () => {
  const m = structuredClone(fx("pending"));
  m.test2.conditions.all.aaron.m32.D_masked_px["h3-fal"] = null;
  const r = leagueRows(m, condOf(m, DEFAULT_STATE), name).find((x) => x.engine === "h3-fal")!;
  expect(r.masked).toBeNull();
  expect(r.note).toBe("no value");
  expect(leagueRows(m, condOf(m, DEFAULT_STATE), name).find((x) => x.engine === "wan22")!.note).toBeNull();
});

describe.each(STATES)("headline parity (%s)", (st) => {
  const m = fx(st);
  it.each(["aaron", "agent"] as const)("matches the writer for %s", (set) => {
    const h = headline(condOf(m, { ...DEFAULT_STATE, masks: set }));
    expect(h.replace(/−/g, "-")).toBe(m.test2.headline_md[set]);
  });
});

describe("headline wording", () => {
  const base = fx("pending");
  const cond = (patch: Partial<MaskedCondition>): MaskedCondition => ({ ...condOf(base, DEFAULT_STATE), ...patch });
  it("says falls, rises or stays", () => {
    expect(headline(cond({ ratio_whole: 8, ratio_masked: 2 }))).toContain("falls from 8.0× to 2.0×");
    expect(headline(cond({ ratio_whole: 2, ratio_masked: 8 }))).toContain("rises from 2.0× to 8.0×");
    expect(headline(cond({ ratio_whole: 3, ratio_masked: 3 }))).toContain("stays from 3.0× to 3.0×");
  });
  it("uses the undefined-gap sentence when a ratio is missing", () => {
    expect(headline(cond({ ratio_masked: null }))).toBe("Post-hoc (A9): on 104 cells the Gen-4.5/Wan ratio is undefined under these masks.");
  });
  it("says no CI when the interval is missing, and n/a for a missing s", () => {
    expect(headline(cond({ s_ci95: null, s: null }))).toContain("(s = n/a, no CI)");
  });
  it("reads a negative s with a true minus", () => {
    expect(headline(cond({ s: -0.5, s_ci95: [-0.7, 0.1] }))).toContain("s = −0.50, 95% CI −0.70 to 0.10");
  });
});

describe("verdicts", () => {
  const m = fx("pending");
  it("has one plain sentence for each of the five verdicts", () => {
    for (const v of ["not testable", "supported", "mask-dependent", "killed", "not supported"] as const) {
      const mm = structuredClone(m); pairVerdict(mm, v);          // the numbers agree with the word
      const out = verdictFor(mm);
      expect(out.verdict).toBe(v);
      expect(out.sentence).toBe(VERDICT_LINES[v]);
      expect(out.sentence.length).toBeGreaterThan(20);
    }
    expect(VERDICT_LINES["not testable"]).toBe("Not testable: on these cells the whole-frame gap is under 2× or undefined.");
  });
  it("refuses a supported verdict whose numbers do not support it (mirrors Test 1's check)", () => {
    const at = (edit: (mm: Masked) => void) => { const mm = structuredClone(m); edit(mm); return mm; };
    expect(() => verdictFor(at((mm) => { mm.test2.conditions.all.aaron.m32.s = 0.49; }))).toThrow(/supported/);
    expect(() => verdictFor(at((mm) => { mm.test2.conditions.all.agent.m32.s = 0.2; }))).toThrow(/supported/);
    expect(() => verdictFor(at((mm) => { mm.test2.conditions.all.agent.m32.s = null; }))).toThrow(/supported/);
    expect(() => verdictFor(at((mm) => { mm.test2.conditions.all.aaron.m32.s_ci95 = [0, 0.7]; }))).toThrow(/supported/);
    expect(() => verdictFor(at((mm) => { mm.test2.conditions.all.aaron.m32.s_ci95 = null; }))).toThrow(/supported/);
    expect(verdictFor(m).verdict).toBe("supported");
    // other verdicts are the writer's call; the page only checks the one it can disprove
    expect(verdictFor(at((mm) => { mm.test2.verdict = "not supported"; mm.test2.conditions.all.aaron.m32.s_ci95 = [-0.1, 0.7]; })).verdict).toBe("not supported");
  });
  it("throws on an unknown verdict", () => {
    const mm = structuredClone(m) as unknown as { test2: { verdict: string } }; mm.test2.verdict = "maybe";
    expect(() => verdictFor(mm as unknown as Masked)).toThrow(/unknown verdict/);
  });
  it("is the same whatever the view", () => {
    const base = verdictFor(m);
    // it takes no view state, and an edited sensitivity cell never reaches it
    expect(verdictFor.length).toBe(1);
    const mm = structuredClone(m); mm.test2.conditions.burst.agent.m64.s = -9; mm.test2.conditions.all.aaron.m64.s = -9;
    expect(verdictFor(mm)).toEqual(base);
  });
  it("flags sensitivity views as unregistered", () => {
    expect(viewStatus(DEFAULT_STATE)).toEqual({ registered: true });
    expect(viewStatus({ ...DEFAULT_STATE, masks: "agent" })).toEqual({ registered: true });
    expect(viewStatus({ ...DEFAULT_STATE, margin: 64 })).toEqual({ registered: false });
    expect(viewStatus({ ...DEFAULT_STATE, margin: 16 })).toEqual({ registered: false });
    expect(viewStatus({ ...DEFAULT_STATE, split: "idle" })).toEqual({ registered: false });
  });
});

describe("test 1", () => {
  it("pending: provisional AARON numbers, no verdict, no R7", () => {
    const v = test1View(fx("pending").test1);
    expect(v.state).toBe("pending");
    expect(v.chip).toBe("Author-rated; second rater pending");
    expect(v.verdict).toBeNull();
    expect(v.reading).toBeNull();
    expect(v.raters.map((r) => r.id)).toEqual(["AARON"]);
    expect(v.raters[0].tag).toBe("provisional (AARON only)");
    expect(v.raters[0].rho).toBe(-1);
    expect(v.raters[0].p).toBeCloseTo(0.00833, 4);
    expect(v.kappa).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/supported/i);
  });
  it("two-rater: both raters, kappa, a verdict that needs both p <= 0.05", () => {
    const t = fx("two-rater").test1;
    const v = test1View(t);
    expect(v.chip).toBe("Two raters");
    expect(v.raters.map((r) => r.id)).toEqual(["AARON", "R7"]);
    expect(v.raters.every((r) => r.tag === null)).toBe(true);
    expect(v.verdict).toBe("Supported");
    expect(v.kappa).toEqual([{ study: "burst", value: 1 }, { study: "push", value: 1 }]);
    expect(v.rule).toContain("0.05");
    const bad = structuredClone(t); bad.raters.R7!.primary.p_le_0_05 = false; bad.verdict = "not supported";
    expect(test1View(bad).verdict).toBe("Not supported");
    const wrong = structuredClone(t); wrong.raters.R7!.primary.p_le_0_05 = false;     // contract says supported
    expect(() => test1View(wrong)).toThrow(/verdict/);
  });
  it("two-rater needs both raters", () => {
    const t = structuredClone(fx("two-rater").test1); t.raters.R7 = null;
    expect(() => test1View(t)).toThrow(/R7/);
  });
  it("fallback: not tested by two raters, AARON tagged author-rated, no verdict", () => {
    const v = test1View(fx("fallback").test1);
    expect(v.reading).toBe("Not tested by two raters");
    expect(v.verdict).toBeNull();
    expect(v.raters.map((r) => [r.id, r.tag])).toEqual([["AARON", "author-rated"]]);
    expect(v.deadline).toBe("2026-11-15");
  });
  it("fallback with R7's late files: AARON and R7 both author-rated, kappa kept, still no verdict", () => {
    const t = fx("fallback-late").test1;
    const v = test1View(t);
    expect(v.state).toBe("fallback");
    expect(v.verdict).toBeNull();
    expect(v.reading).toBe("Not tested by two raters");
    expect(v.raters.map((r) => [r.id, r.tag])).toEqual([["AARON", "author-rated"], ["R7", "author-rated"]]);
    expect(v.raters[1].rho).toBe(t.raters.R7!.primary.rho);
    expect(v.kappa).toEqual([{ study: "burst", value: 1 }, { study: "push", value: 1 }]);
    expect(JSON.stringify(v)).not.toMatch(/"verdict":"/);
  });
  it("fallback without R7 keeps AARON alone and no kappa", () => {
    const v = test1View(fx("fallback").test1);
    expect(v.raters.map((r) => r.id)).toEqual(["AARON"]);
    expect(v.kappa).toBeNull();
  });
  it("passes rates and Wilson intervals through in league order, and derives the attainable-p note", () => {
    const t = fx("pending").test1;
    const v = test1View(t);
    expect(v.raters[0].engines.map((e) => e.engine)).toEqual(Object.keys(t.raters.AARON.primary.per_engine));
    expect(v.raters[0].engines[0]).toMatchObject({ n: 22, misses: 18, lo: 0.614833925629, hi: 0.926931154166, steadiness: 0.84 });
    expect(v.attainable).toBe("With five engines, without ties, only rho of −0.9 or lower can reach p of 0.05.");
  });
  it("never uses the forbidden words", () => {
    for (const s of STATES) expect(JSON.stringify(test1View(fx(s).test1))).not.toMatch(FORBIDDEN);
  });
});

describe("wording guard", () => {
  it("none of the strings the model can return use forbidden words", () => {
    const strings = [...Object.values(VERDICT_LINES)];
    for (const s of STATES) {
      const m = fx(s);
      strings.push(headline(condOf(m, DEFAULT_STATE)), headline(condOf(m, { ...DEFAULT_STATE, masks: "agent" })), JSON.stringify(test1View(m.test1)));
    }
    for (const t of strings) expect(t).not.toMatch(FORBIDDEN);
  });
});

describe("geometry (checked against crop_geometry in metrics/masked.py)", () => {
  const sq: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const bbox = (p: [number, number][]) => [Math.min(...p.map((x) => x[0])), Math.min(...p.map((x) => x[1])), Math.max(...p.map((x) => x[0])), Math.max(...p.map((x) => x[1]))];
  it("stretch maps fractions to the frame", () => {
    expect(frameMask([[0.5, 0.25]], [1344, 768], [1280, 704], "stretch")).toEqual([[640, 176]]);
  });
  it("centre-crop: 1344x768 on 1280x704 scales to 1280x731, top 13, left 0", () => {
    expect(bbox(frameMask(sq, [1344, 768], [1280, 704], "centre-crop"))).toEqual([0, -13, 1280, 718]);
  });
  it("centre-crop: 1344x768 on 1280x720 has top 5", () => {
    expect(bbox(frameMask(sq, [1344, 768], [1280, 720], "centre-crop"))).toEqual([0, -5, 1280, 726]);
  });
  it("centre-crop: 1344x768 on 1344x768 is the identity", () => {
    expect(frameMask([[0.25, 0.5]], [1344, 768], [1344, 768], "centre-crop")).toEqual([[336, 384]]);
  });
  it("centre-crop: portrait 1024x1792 on 720x1280 scales to 731x1280, left 5", () => {
    expect(bbox(frameMask(sq, [1024, 1792], [720, 1280], "centre-crop"))).toEqual([-5, 0, 726, 1280]);
  });
  it("rounds the scaled size half to even, like Python's round", () => {
    // 100x101 panel on a 150x150 frame: s = 1.5, 101 * 1.5 = 151.5 -> 152 (even), top = 1
    expect(frameMask([[0, 1]], [100, 101], [150, 150], "centre-crop")).toEqual([[0, 151]]);
    // 100x103 panel: s = 1.5, 154.5 -> 154 (even), top = 2, so y = 154 - 2
    expect(frameMask([[0, 1]], [100, 103], [150, 150], "centre-crop")).toEqual([[0, 152]]);
  });
  it("the stroke for margin m is 2m frame pixels", () => {
    expect(marginStroke(32)).toBe(64);
    expect(marginStroke(16)).toBe(32);
  });
  it("regionPath gives SVG path data for every ring", () => {
    const d = regionPath([[[0, 0], [0.5, 0], [0.5, 0.5]], [[1, 1], [0.5, 1], [0.5, 0.5]]], panelMapper([200, 100]));
    expect(d).toBe("M0 0L100 0L100 50ZM200 100L100 100L100 50Z");
    expect(regionPath([], panelMapper([200, 100]))).toBe("");
  });
});

describe("slope layout", () => {
  const m = fx("pending");
  const rows = leagueRows(m, condOf(m, DEFAULT_STATE), name);
  it("keeps labels 13 px apart on both sides", () => {
    const s = slope(rows, 240);
    for (const side of ["ly", "ry"] as const) {
      const ys = s.map((x) => x[side]).filter((y): y is number => y !== null).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(13 - 1e-9);
    }
  });
  it("shares one scale: higher px is higher on the chart", () => {
    const s = slope(rows, 240);
    const a = s.find((x) => x.engine === "wan22")!, b = s.find((x) => x.engine === "h3-fal")!;
    expect(b.yl).toBeLessThan(a.yl);
    expect(s.every((x) => x.line)).toBe(true);
  });
  it("draws no line for a null masked value", () => {
    const mm = structuredClone(m); mm.test2.conditions.all.aaron.m32.D_masked_px["ltx23"] = null;
    const s = slope(leagueRows(mm, condOf(mm, DEFAULT_STATE), name), 240);
    const x = s.find((r) => r.engine === "ltx23")!;
    expect(x.line).toBe(false);
    expect(x.yr).toBeNull();
    expect(x.ry).toBeNull();
    expect(s.filter((r) => r.line)).toHaveLength(4);
  });
});


describe("regionState", () => {
  const m = fx("pending");
  const row = (id: string) => m.rows.find((r) => r.row === id)!;
  it("tells a drawn region, a nothing-allowed row and a whole-panel mask apart", () => {
    expect(regionState(row("act-black-2_idle"), "aaron")).toBe("region");
    expect(regionState(row("chain-est-cosmic-1_burst"), "aaron")).toBe("nothing-allowed");
    expect(regionState(row("est-black-3_burst"), "aaron")).toBe("nothing-allowed");
    expect(regionState(row("est-black-3_burst"), "agent")).toBe("region");
    const whole = structuredClone(row("cu-line-2_burst")); whole.polygons.aaron = [[[0, 0], [1, 0], [1, 1], [0, 1]]];
    expect(regionState(whole, "aaron")).toBe("whole-panel");
    whole.polygons.aaron = [[[0, 0], [0.5, 0], [0.5, 1], [0, 1]]];
    expect(regionState(whole, "aaron")).toBe("region");
  });
});

describe("test 1 extras", () => {
  it("states the registered rule in words in every state, without a verdict word", () => {
    for (const st of STATES) {
      const v = test1View(fx(st).test1);
      expect(v.rule).toBe("Registered rule: both raters' exact one-sided p of 0.05 or lower.");
    }
    expect(JSON.stringify(test1View(fx("pending").test1))).not.toMatch(/supported/i);
  });
  it("carries the miss definition, the sensitivity view, the within-row check and the motion AUC", () => {
    const v = test1View(fx("two-rater").test1);
    const a = v.raters[0];
    expect(v.miss).toBe("score \u2264 2");
    expect(a.more.sensitivity!.miss).toBe("score \u2264 3");
    expect(a.more.sensitivity!.engines.map((e) => e.engine)).toEqual(a.engines.map((e) => e.engine));
    expect(a.more.withinRow).toMatchObject({ nRows: 22, nRowsDefined: 17 });
    expect(a.more.withinRow!.meanRho).toBeCloseTo(0.7819, 3);
    expect(a.more.auc.map((x) => x.study)).toEqual(["burst", "push"]);
    expect(a.more.auc[0].reading).toBe("corroborates: the misses are under-animated");
  });
  it("tolerates a writer that leaves the extra blocks out", () => {
    const t = structuredClone(fx("pending").test1);
    const a = t.raters.AARON as Record<string, unknown>;
    delete a.sensitivity_miss_le_3; delete a.within_row; delete a.motion_auc;
    const r = test1View(t).raters[0];
    expect(r.more).toEqual({ sensitivity: null, withinRow: null, auc: [] });
  });
});


describe("fitLabel", () => {
  const w = (s: string) => s.length * 7;
  it("keeps a label that fits, whole", () => {
    expect(fitLabel("Wan 2.2", " 1.01", 200, w)).toEqual({ text: "Wan 2.2 1.01", full: "Wan 2.2 1.01", cut: false });
  });
  it("cuts the name, never the figure, and keeps the full text", () => {
    const name = "Engine-with-a-name-that-never-ever-breaks";
    const r = fitLabel(name, " 1.01", 150, w);
    expect(r.cut).toBe(true);
    expect(r.text.endsWith("\u2026 1.01")).toBe(true);
    expect(w(r.text)).toBeLessThanOrEqual(150);
    expect(r.full).toBe(`${name} 1.01`);
  });
  it("still shows something when the room is tiny", () => {
    expect(fitLabel("Gen-4.5", ": no value", 10, w).text).toBe("\u2026: no value");
  });
});

describe("pxr", () => {
  it("is the house px format for ordinary values", () => {
    expect(pxr(1.01)).toBe("1.01 px");
    expect(pxr(-3.4)).toBe("\u22123.40 px");
    expect(pxr(0)).toBe("0.00 px");
  });
  it("keeps a tiny non-zero value readable, never as 0.00 and never with an exponent", () => {
    expect(pxr(0.0000012)).toBe("0.0000012 px");
    expect(pxr(0.004)).toBe("0.0040 px");
  });
  it("writes a huge value in full", () => {
    expect(pxr(1e6)).toBe("1000000.00 px");
    expect(pxr(1e21)).not.toMatch(/e/i);
  });
});


describe("the R7 declaration note", () => {
  it("pending: present perfect, never past tense, and nothing gendered", () => {
    expect(r7Note("pending", true)).toBe("R7 has declared not having seen the explorer, the release or these clips.");
    expect(r7Note("pending", false)).toBe("R7 has declared prior exposure (see the amendment).");
    expect(r7Note("pending", null)).toBeNull();
  });
  it.each(["two-rater", "fallback"] as const)("%s: declared before rating", (state) => {
    expect(r7Note(state, true)).toBe("R7 declared not having seen the explorer, the release or these clips before rating.");
    expect(r7Note(state, false)).toBe("R7 declared prior exposure (see the amendment).");
    expect(r7Note(state, null)).toBeNull();
  });
  it("is on the view, from the contract's three-valued flag", () => {
    const t = structuredClone(fx("two-rater").test1);
    expect(test1View(t).r7Note).toContain("before rating");
    t.r7_blind_to_engine_styles = null;
    expect(test1View(t).r7Note).toBeNull();
    expect(JSON.stringify(test1View(fx("pending").test1))).not.toMatch(/\b(she|her|he|his)\b/i);
  });
});

describe("headlines (A9.4: one per mask set at 32 px over all eligible rows)", () => {
  const m = fx("pending");
  it("the registered view shows both sets, each labelled, as the writer's sentences", () => {
    const hs = headlineViews(m, DEFAULT_STATE);
    expect(hs.map((h) => [h.key, h.label])).toEqual([["aaron", "Aaron's set"], ["agent", "Blind set"]]);
    expect(hs.every((h) => h.registered)).toBe(true);
    expect(hs.map((h) => h.text.replace(/−/g, "-"))).toEqual([m.test2.headline_md.aaron, m.test2.headline_md.agent]);
  });
  it("the registered view does not depend on the mask control", () => {
    expect(headlineViews(m, { ...DEFAULT_STATE, masks: "agent" })).toEqual(headlineViews(m, DEFAULT_STATE));
  });
  it("another margin or split shows the current condition alone, labelled as not registered", () => {
    const hs = headlineViews(m, { ...DEFAULT_STATE, masks: "agent", margin: 64, split: "idle" });
    expect(hs).toHaveLength(1);
    expect(hs[0]).toMatchObject({ key: "agent", registered: false });
    expect(hs[0].label).toBe("Blind set, 64 px, idle only");
    expect(hs[0].text).toBe(headline(condOf(m, { masks: "agent", margin: 64, split: "idle" })));
  });
});

describe("the gallery margin is in panel pixels (2m x the panel-to-grid scale)", () => {
  it("uses the 1280x720 grid for landscape panels and 720x1280 for the portrait panel", () => {
    expect(gridFor(1344, 768)).toEqual([1280, 720]);
    expect(gridFor(1024, 1792)).toEqual([720, 1280]);
  });
  it("landscape: 1344x768, m 32", () => {
    expect(galleryStroke(32, 1344, 768)).toBeCloseTo(64 * Math.max(1344 / 1280, 768 / 720), 6);
  });
  it("the 1024x1792 tank panel, m 32, is about 91 px, not 51", () => {
    expect(galleryStroke(32, 1024, 1792)).toBeCloseTo(91.0, 0);
    expect(galleryStroke(32, 1024, 1792)).toBeCloseTo(64 * (1024 / 720), 6);
  });
});
