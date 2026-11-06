import { Suspense } from "react";
import { masked as writeup } from "virtual:thesis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { fixture, stubResizeObserver, type MaskedStateName } from "../../test/maskedKit";
import { CoreProvider } from "../../data/core";
import { PlainWordsProvider } from "../../plainwords/state";
import Masked from "./Masked";
import { VERDICT_LINES } from "./maskedModel";
import { pairVerdict } from "../../test/pairVerdict";

const h = vi.hoisted(() => ({ published: true, state: "pending" as string, edit: null as null | ((m: any) => void), requests: 0, core: null as any, masked: null as any }));
vi.mock("../../data/load", async () => {
  const kit = await import("../../test/maskedKit");
  return {
    loadCore: () => (h.core ??= Promise.resolve(kit.makeCore(h.published))),
    loadMasked: () => {
      h.requests++;
      return (h.masked ??= Promise.resolve(kit.fixture(h.state as MaskedStateName)).then((m) => { h.edit?.(m); return m; }));
    },
    loadSeries: () => Promise.resolve({}), retrySeries: () => {},
  };
});

const NAMES = ["Wan 2.2", "Gen-4 Turbo", "LTX-2.3", "Gen-4.5", "H3"];
async function show(state: MaskedStateName = "pending", { published = true, edit = null as null | ((m: any) => void), url = "" } = {}) {
  h.published = published; h.state = state; h.edit = edit; h.core = null; h.masked = null; h.requests = 0;
  history.replaceState(null, "", "/tax/masked" + url);
  await act(async () => { render(<Suspense fallback="loading"><CoreProvider><Masked debounceMs={0} /></CoreProvider></Suspense>); });
  await screen.findByRole("heading", { level: 1 });
  if (published) await screen.findAllByTestId("headline");
}
beforeEach(() => { stubResizeObserver(); });
afterEach(cleanup);

describe("the page", () => {
  it("shows the title, the chip, the generated headline and the verdict card", async () => {
    await show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Drift where nothing should move");
    expect(screen.getAllByText("Exploratory, post-hoc · A9").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("headline").map((h) => h.textContent!.replace(/−/g, "-"))).toEqual([fixture().test2.headline_md.aaron, fixture().test2.headline_md.agent]);
    expect(screen.getByTestId("verdict").textContent).toContain(VERDICT_LINES.supported);
    expect(document.title).toBe("Drift where nothing should move · StillDrawn Explorer");
  });

  it("has a league table with no rank column, in league order, masked beside whole-frame", async () => {
    await show();
    const table = screen.getByRole("table", { name: /median drift/i });
    const heads = within(table).getAllByRole("columnheader").map((c) => c.textContent);
    expect(heads).toEqual(["Engine", "Clips", "Whole-frame median", "Masked median"]);
    expect(heads.join(" ")).not.toMatch(/rank|place/i);
    const rows = within(table).getAllByTestId("league-row");
    expect(rows.map((r) => r.getAttribute("data-engine"))).toEqual(["wan22", "gen4_turbo", "ltx23", "gen4.5", "h3-fal"]);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(NAMES);
    const c = fixture().test2.conditions.all.aaron.m32;
    const cells = within(rows[3]).getAllByRole("cell").map((x) => x.textContent);
    expect(cells.slice(2)).toEqual([`${c.D_whole_px["gen4.5"]!.toFixed(2)} px`, `${c.D_masked_px["gen4.5"]!.toFixed(2)} px`]);
  });

  it("the registered view shows one headline per mask set, each labelled with its set", async () => {
    await show();
    const hs = screen.getAllByTestId("headline");
    expect(hs.map((h) => h.getAttribute("data-set"))).toEqual(["aaron", "agent"]);
    expect(hs[0].textContent).toContain("to 2.0×");
    expect(hs[1].textContent).toContain("to 2.2×");
    expect(screen.getAllByTestId("headline-label").map((l) => l.textContent)).toEqual(["Aaron's set", "Blind set"]);
    expect(screen.queryByTestId("sensitivity")).toBeNull();
  });

  it("switching to the Blind set keeps both registered headlines, changes the URL, and speaks", async () => {
    await show();
    fireEvent.click(screen.getByRole("radio", { name: "Blind set" }));
    expect(screen.getAllByTestId("headline")).toHaveLength(2);
    expect(location.search).toBe("?masks=agent");
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(screen.getByRole("status").textContent).toBe("Blind set, 32 px: Gen-4.5/Wan falls from 8.0× to 2.2×");
  });

  it("a sensitivity view says so and leaves the verdict card alone", async () => {
    await show();
    const card = screen.getByTestId("verdict").textContent;
    expect(screen.queryByText(/Sensitivity view: no verdict/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "64 px" }));
    expect(location.search).toBe("?margin=64");
    expect(screen.getByText(/Sensitivity view: no verdict/)).toBeTruthy();
    // off the registered condition: the current condition's own headline, labelled, and the note says which view is registered
    expect(screen.getAllByTestId("headline")).toHaveLength(1);
    expect(screen.getByTestId("headline-label").textContent).toBe("Aaron's set, 64 px, all cells");
    expect(screen.getByTestId("sensitivity").textContent).toMatch(/registered.*32 px.*all cells/i);
    expect(screen.getByTestId("verdict").textContent).toBe(card);
    fireEvent.click(screen.getByRole("radio", { name: "Burst only" }));
    expect(screen.getByTestId("verdict").textContent).toBe(card);
  });

  it("shows all five verdicts from the registered cells", async () => {
    for (const v of Object.keys(VERDICT_LINES)) {
      await show("pending", { edit: (m) => { pairVerdict(m, v as keyof typeof VERDICT_LINES); } });
      expect(screen.getByTestId("verdict").textContent).toContain(VERDICT_LINES[v as keyof typeof VERDICT_LINES]);
      cleanup();
    }
  });

  it("toggles the chart for the grid table, and the svg lists every value", async () => {
    await show();
    const svg = screen.getByRole("img", { name: /median drift/i });
    for (const n of NAMES) expect(svg.getAttribute("aria-label")).toContain(n);
    expect(svg.getAttribute("aria-label")).toContain("8.08 px");
    const btn = screen.getByRole("button", { name: "Show as table" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(location.search).toBe("?table=1");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("img", { name: /median drift/i })).toBeNull();
    const grid = screen.getByRole("table", { name: /all six conditions/i });
    expect(within(grid).getAllByRole("row")).toHaveLength(7);
    // every cell pairs the two medians on the same cells
    expect(within(grid).getAllByRole("row")[1].textContent).toMatch(/1\.01 px → 1\.01 px/);
  });

  it("every panel on the page sits under the Exploratory, post-hoc · A9 chip, the slopegraph and verdict panels included", async () => {
    await show();
    const heads = [...document.querySelectorAll(".panel-head")];
    expect(heads.length).toBeGreaterThanOrEqual(5);
    for (const h of heads) expect(h.querySelector(".chip")?.textContent, h.textContent ?? "").toBe("Exploratory, post-hoc · A9");
    expect(screen.getByTestId("verdict").querySelector(".panel-head .chip")).not.toBeNull();
    expect(document.querySelector(".chart-panel .panel-head .chip")).not.toBeNull();
  });

  it("an unpublished file renders a plain notice and requests nothing", async () => {
    await show("pending", { published: false });
    expect(screen.getByText("These results are not published yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Stillness Tax/ }).getAttribute("href")).toBe("/tax");
    expect(h.requests).toBe(0);
  });

  it("never uses wording the rules forbid", async () => {
    for (const s of ["pending", "two-rater", "fallback", "fallback-late"] as const) {
      await show(s, { url: "?table=1" });
      expect(document.body.textContent).not.toMatch(/doubling|log2|log₂|\b2\.6\b|rank/i);
      cleanup();
    }
  });
});

describe("the masks gallery on the page", () => {
  it("lists 22 rows, opens a row's detail from the URL, and follows the controls", async () => {
    await show("pending", { url: "?row=act-black-2_idle" });
    expect(screen.getAllByTestId("mk-tile")).toHaveLength(22);
    expect(screen.getAllByTestId("mk-engine")).toHaveLength(5);
    const d0 = document.querySelector('[data-row="act-black-2_idle"] path.mk-allowed')!.getAttribute("d");
    fireEvent.click(screen.getByRole("radio", { name: "Blind set" }));
    expect(document.querySelector('[data-row="act-black-2_idle"] path.mk-allowed')!.getAttribute("d")).not.toBe(d0);
    expect(Object.fromEntries(new URLSearchParams(location.search))).toEqual({ masks: "agent", row: "act-black-2_idle" });
  });
  it("selecting a tile sets ?row= and selecting it again closes the detail", async () => {
    await show();
    expect(screen.queryAllByTestId("mk-engine")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "cu-tone-3 idle, eligible" }));
    expect(location.search).toBe("?row=cu-tone-3_idle");
    expect(screen.getAllByTestId("mk-engine")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "cu-tone-3 idle, eligible" }));
    expect(location.search).toBe("");
    expect(screen.queryAllByTestId("mk-engine")).toHaveLength(0);
  });
});


describe("Test 1 on the page", () => {
  it.each([["pending", false, "Author-rated; second rater pending"], ["fallback", false, "Not tested by two raters"], ["fallback-late", false, "Not tested by two raters"], ["two-rater", true, "Two raters"]] as const)(
    "%s renders its state from the contract", async (state, verdict, text) => {
      await show(state);
      const panel = screen.getByRole("region", { name: /Test 1/ });
      expect(panel.textContent).toContain(text);
      expect(!!within(panel).queryByTestId("test1-verdict")).toBe(verdict);
    });
});

describe("plain words on the page", () => {
  const notes = () => [...document.querySelectorAll<HTMLElement>(".pw-note")].map((n) => n.dataset.note);
  async function plain(state: MaskedStateName, edit: null | ((m: any) => void) = null) {
    h.published = true; h.state = state; h.edit = edit; h.core = null; h.masked = null;
    history.replaceState(null, "", "/tax/masked?plain=1");
    await act(async () => { render(<Suspense fallback="loading"><CoreProvider><PlainWordsProvider><Masked debounceMs={0} /></PlainWordsProvider></CoreProvider></Suspense>); });
    await screen.findAllByTestId("headline");
  }
  afterEach(() => { try { localStorage.clear(); } catch { /* none */ } });

  it("is silent until the layer is on", async () => {
    await show();
    expect(notes()).toEqual([]);
  });
  it("pending: the three method notes and the pending note, each once, before what they explain", async () => {
    await plain("pending");
    expect(notes()).toEqual(["masked.slope", "masked.gallery", "masked.test1", "masked.test1.pending"]);
    const slope = document.querySelector('[data-note="masked.slope"]')!, chart = screen.getByRole("img", { name: /median drift/i });
    expect(slope.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("fallback and two-rater carry their own state note, or none", async () => {
    await plain("fallback");
    expect(notes()).toEqual(["masked.slope", "masked.gallery", "masked.test1", "masked.test1.fallback"]);
    cleanup();
    await plain("fallback-late");
    expect(notes()).toEqual(["masked.slope", "masked.gallery", "masked.test1", "masked.test1.fallback"]);
    cleanup();
    await plain("two-rater");
    expect(notes()).toEqual(["masked.slope", "masked.gallery", "masked.test1"]);
  });
  it("a killed verdict adds its result line, once, right after the verdict card and before the slope note", async () => {
    await plain("pending", (m) => pairVerdict(m, "killed"));
    expect(notes()).toEqual(["masked.verdict.killed", "masked.slope", "masked.gallery", "masked.test1", "masked.test1.pending"]);
    const verdictCard = screen.getByTestId("verdict"), note = document.querySelector('[data-note="masked.verdict.killed"]')!;
    expect(verdictCard.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(note.textContent).toContain("The answer was no.");
  });
  it("every other Test 2 verdict leaves that line out", async () => {
    for (const v of ["supported", "mask-dependent", "not supported", "not testable"] as const) {
      await plain("pending", (m) => pairVerdict(m, v));
      expect(notes(), v).not.toContain("masked.verdict.killed");
      cleanup();
    }
  });
  it("two raters and a Test 1 verdict of not supported add their result line after the Test 1 notes", async () => {
    await plain("two-rater", (m) => { m.test1.verdict = "not supported"; m.test1.raters.R7.primary.p_le_0_05 = false; });
    expect(notes()).toEqual(["masked.slope", "masked.gallery", "masked.test1", "masked.test1.not-supported"]);
    expect(document.querySelector('[data-note="masked.test1.not-supported"]')!.textContent).toContain("So the test says: not proven.");
  });
  it("a supported Test 1 verdict, or any state without a second rater, leaves it out", async () => {
    await plain("two-rater");
    expect(notes()).not.toContain("masked.test1.not-supported");
    cleanup();
    for (const state of ["pending", "fallback", "fallback-late"] as const) {
      await plain(state);
      expect(notes(), state).not.toContain("masked.test1.not-supported");
      cleanup();
    }
  });
});

describe("the write-up", () => {
  // MASKED-DRIFT.md is parsed at build time (virtual:thesis exports null while it is the placeholder).
  const placeholder = writeup == null;
  it.runIf(placeholder)("is hidden while MASKED-DRIFT.md is the placeholder: no section, no links, no sentinel", async () => {
    await show();
    expect(screen.queryByRole("region", { name: /write-up/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Placeholder|not written yet|PREREGISTRATION/);
    expect(document.querySelector('a[href*="a9-registered"]')).toBeNull();
  });
  it.runIf(!placeholder)("shows once written: its words, its links, never the sentinel", async () => {
    await show();
    expect(document.body.textContent).toContain("Drift where nothing should move");
    expect(document.body.textContent).toMatch(/exploratory, post-hoc/);
    expect(document.body.textContent).not.toMatch(/Placeholder|not written yet/);
    expect(document.querySelector('a[href*="a9-registered"]')).not.toBeNull();
  });
});
