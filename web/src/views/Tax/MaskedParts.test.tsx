import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { fixture, makeCore, stubResizeObserver } from "../../test/maskedKit";
import { DEFAULT_STATE, type MaskedState } from "./maskedModel";
import { Gallery, RowDetail, Test1, Writeup } from "./MaskedParts";
import { parseThesis } from "../About/thesisMd";

beforeEach(stubResizeObserver);
afterEach(cleanup);
const core = makeCore(true);
const m = fixture();
const st = (p: Partial<MaskedState> = {}): MaskedState => ({ ...DEFAULT_STATE, ...p });
const tile = (row: string) => document.querySelector<HTMLElement>(`[data-row="${row}"]`)!;

describe("Gallery", () => {
  it("renders 22 rows as pressable buttons with the panel image and an overlay", () => {
    const pick = vi.fn();
    render(<Gallery core={core} m={m} state={st({ row: "act-black-2_idle" })} onSelect={pick} />);
    const tiles = screen.getAllByTestId("mk-tile");
    expect(tiles).toHaveLength(22);
    const t = screen.getByRole("button", { name: "act-black-2 idle, eligible" });
    expect(t.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "act-black-3 burst, eligible" }).getAttribute("aria-pressed")).toBe("false");
    const img = t.querySelector("img")!;
    expect(img.getAttribute("src")).toContain("panels/act-black-2.webp");
    expect(img.getAttribute("srcset")).toMatch(/-w320\.webp 320w/);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("width")).toBe("1344");
    expect(img.getAttribute("height")).toBe("768");
    expect(t.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 1344 768");
    fireEvent.click(screen.getByRole("button", { name: "act-black-3 burst, eligible" }));
    expect(pick).toHaveBeenCalledWith("act-black-3_burst");
  });

  it("shades the measured region with a mask, and outlines where the prompt allows movement", () => {
    render(<Gallery core={core} m={m} state={st()} onSelect={() => {}} />);
    const svg = tile("act-black-2_idle").querySelector("svg")!;
    const mask = svg.querySelector("mask")!;
    expect(mask.querySelector("rect")!.getAttribute("fill")).toBe("#fff");
    const hole = mask.querySelector("path")!;
    expect(hole.getAttribute("fill")).toBe("#000");
    expect(Number(hole.getAttribute("stroke-width"))).toBeCloseTo(2 * 32 * Math.max(1344 / 1280, 768 / 720), 6);
    expect(hole.getAttribute("stroke-linejoin")).toBe("round");
    const shade = svg.querySelector("rect.mk-shade")!;
    expect(shade.getAttribute("mask")).toBe(`url(#${mask.id})`);
    const outline = svg.querySelector("path.mk-allowed")!;
    expect(outline.getAttribute("d")).toMatch(/^M/);
  });

  it("the mask set and the margin change every overlay", () => {
    const { rerender } = render(<Gallery core={core} m={m} state={st()} onSelect={() => {}} />);
    const d0 = tile("act-black-2_idle").querySelector("path.mk-allowed")!.getAttribute("d");
    const w0 = tile("act-black-2_idle").querySelector("mask path")!.getAttribute("stroke-width");
    rerender(<Gallery core={core} m={m} state={st({ masks: "agent", margin: 64 })} onSelect={() => {}} />);
    expect(tile("act-black-2_idle").querySelector("path.mk-allowed")!.getAttribute("d")).not.toBe(d0);
    expect(Number(tile("act-black-2_idle").querySelector("mask path")!.getAttribute("stroke-width"))).toBeCloseTo(Number(w0) * 2, 6);
  });

  it("the portrait tank panel's margin is scaled to its own 720x1280 grid, about 91 px for 32", () => {
    const tank = m.rows.find((r) => core.panel(r.panel)!.height > core.panel(r.panel)!.width)!;
    expect([core.panel(tank.panel)!.width, core.panel(tank.panel)!.height]).toEqual([1024, 1792]);
    render(<Gallery core={core} m={m} state={st()} onSelect={() => {}} />);
    const w = Number(tile(tank.row).querySelector("mask path")!.getAttribute("stroke-width"));
    expect(w).toBeGreaterThan(90);
    expect(w).toBeLessThan(92);
  });

  it("a nothing-allowed row has no outline, shades the whole panel and says so", () => {
    render(<Gallery core={core} m={m} state={st()} onSelect={() => {}} />);
    const t = tile("chain-est-cosmic-1_burst");
    expect(t.querySelector("path.mk-allowed")).toBeNull();
    expect(t.querySelector("mask path")).toBeNull();
    expect(t.textContent).toContain("Nothing may move here, so the whole frame is measured");
    // set-specific: the blind set draws est-black-3_burst, Aaron's does not
    expect(tile("est-black-3_burst").textContent).toContain("Nothing may move here");
  });

  it("an ineligible row says it was left out", () => {
    render(<Gallery core={core} m={m} state={st()} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /^cu-line-2 burst\s*Left out/ })).toBeTruthy();
    expect(tile("cu-line-2_burst").textContent).toContain("Left out: too few line pixels in the measured region");
  });

  it("a whole-panel mask leaves nothing to measure", () => {
    const mm = fixture(); mm.rows.find((r) => r.row === "cu-black-2_idle")!.polygons.aaron = [[[0, 0], [1, 0], [1, 1], [0, 1]]];
    render(<Gallery core={core} m={mm} state={st()} onSelect={() => {}} />);
    expect(tile("cu-black-2_idle").textContent).toContain("Nothing left to measure");
  });

  it("says that each engine's frame maps the drawing slightly differently", () => {
    render(<Gallery core={core} m={m} state={st()} onSelect={() => {}} />);
    expect(screen.getByText(/Drawn on the panel; each engine's frame maps it slightly differently \(see the row\)/)).toBeTruthy();
  });
});

describe("RowDetail", () => {
  it("shows five posters in league order with two values each, and the frame-96 note", () => {
    render(<RowDetail core={core} m={m} state={st({ row: "act-black-2_idle" })} />);
    const figs = screen.getAllByTestId("mk-engine");
    expect(figs.map((f) => f.getAttribute("data-engine"))).toEqual(m.engine_order);
    const wan = figs[0];
    const img = wan.querySelector("img")!;
    expect(img.getAttribute("src")).toContain("posters/act-black-2_idle_wan22-w320.webp");
    const clip = core.clip("act-black-2_idle_wan22")!;
    expect(wan.querySelector("svg")!.getAttribute("viewBox")).toBe(`0 0 ${clip.width} ${clip.height}`);
    expect(wan.textContent).toMatch(/Whole frame\s*1\.00 px/);
    expect(wan.textContent).toMatch(/Masked\s*1\.00 px/);
    expect(screen.getByText(/Frame 96 is shown; the region applies to every frame/)).toBeTruthy();
    const link = within(wan).getByRole("link", { name: /Open in Explore/ });
    expect(link.getAttribute("href")).toBe("/explore?cell=act-black-2_idle&e=wan22");
  });

  it("maps the mask onto each clip with its own mapping", () => {
    render(<RowDetail core={core} m={m} state={st({ row: "act-black-2_idle" })} />);
    const crop = screen.getAllByTestId("mk-engine")[0].querySelector("path.mk-allowed")!.getAttribute("d")!;
    const stretch = screen.getAllByTestId("mk-engine")[4].querySelector("path.mk-allowed")!.getAttribute("d")!;
    expect(m.rows[0].clips["wan22"].mapping).toBe("centre-crop");
    expect(crop).not.toBe(stretch);
    const stroke = screen.getAllByTestId("mk-engine")[0].querySelector("mask path")!.getAttribute("stroke-width");
    expect(stroke).toBe("64");
  });

  it("flags a cell left out of the medians, and an unscorable one", () => {
    const mm = fixture();
    const row = mm.rows.find((r) => r.row === "act-black-2_idle")!;
    row.clips["ltx23"].masked.aaron.m32.f0 = 120;
    row.clips["gen4.5"].masked.aaron.m32 = { ...row.clips["gen4.5"].masked.aaron.m32, px: null, unscorable: true };
    render(<RowDetail core={core} m={mm} state={st({ row: "act-black-2_idle" })} />);
    const figs = screen.getAllByTestId("mk-engine");
    expect(figs[2].textContent).toContain("Left out of the medians");
    expect(figs[3].textContent).toContain("no value");
    expect(figs[0].textContent).not.toContain("Left out of the medians");
  });

  it("names an engine that was not generated, with the contract's reason", () => {
    render(<RowDetail core={core} m={m} state={st({ row: "cu-tone-3_idle" })} />);
    const figs = screen.getAllByTestId("mk-engine");
    expect(figs).toHaveLength(5);
    const turbo = figs[1];
    expect(turbo.getAttribute("data-engine")).toBe("gen4_turbo");
    expect(turbo.textContent).toContain("Not generated");
    expect(turbo.textContent).toContain("Refused by the engine's moderation");
    expect(turbo.querySelector("img")).toBeNull();
  });

  it("says in the detail what the mask leaves: nothing may move, or nothing left to measure", () => {
    const { unmount } = render(<RowDetail core={core} m={m} state={st({ row: "chain-est-cosmic-1_burst" })} />);
    expect(screen.getByTestId("mk-legend").textContent).toBe("Nothing may move here, so the whole frame is measured");
    unmount();
    const mm = fixture();
    mm.rows.find((r) => r.row === "cu-black-2_idle")!.polygons.aaron = [[[0, 0], [1, 0], [1, 1], [0, 1]]];
    render(<RowDetail core={core} m={mm} state={st({ row: "cu-black-2_idle" })} />);
    expect(screen.getByTestId("mk-legend").textContent).toBe("Nothing left to measure");
  });
  it("shows no legend for an ordinary mask", () => {
    render(<RowDetail core={core} m={m} state={st({ row: "act-black-2_idle" })} />);
    expect(screen.queryByTestId("mk-legend")).toBeNull();
  });

  it("explains instead of showing values for a row that was left out", () => {
    render(<RowDetail core={core} m={m} state={st({ row: "cu-line-2_burst" })} />);
    expect(screen.getByText(/This row is left out of Test 2: too few line pixels fall in the measured region/)).toBeTruthy();
    expect(screen.queryAllByTestId("mk-engine")).toHaveLength(0);
  });

  it("renders values only when posters are off (cut order step 2)", () => {
    render(<RowDetail core={core} m={m} state={st({ row: "act-black-2_idle" })} postersOff />);
    expect(screen.getAllByTestId("mk-engine")).toHaveLength(5);
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("renders nothing for an unknown row", () => {
    const { container } = render(<RowDetail core={core} m={m} state={st({ row: "nope" })} />);
    expect(container.textContent).toBe("");
  });
});

describe("Test1", () => {
  const show = (state: "pending" | "two-rater" | "fallback" | "fallback-late", edit?: (t: any) => void) => {
    const f = fixture(state); edit?.(f.test1);
    return render(<Test1 core={core} t={f.test1} order={f.engine_order} />).container;
  };
  const text = (c: HTMLElement) => c.textContent!;

  it("pending: the chip, AARON's numbers tagged provisional, no verdict word, no R7", () => {
    const c = show("pending");
    expect(within(c).getByText("Author-rated; second rater pending")).toBeTruthy();
    expect(within(c).getAllByText("provisional (AARON only)").length).toBeGreaterThan(0);
    expect(text(c)).toMatch(/\u22121\.00/);          // AARON's rho
    expect(text(c)).toContain("0.008");                // AARON's exact one-sided p
    expect(text(c)).toContain("No verdict until the second rater's ratings arrive");
    expect(text(c).replace("No verdict until the second rater's ratings arrive", "")).not.toMatch(/\bsupported\b|\bkilled\b/i);
    expect(within(c).queryByRole("heading", { name: /R7/ })).toBeNull();
    expect(text(c)).toContain("2026-11-15");
  });

  it("two-rater: both raters, kappa per study, the verdict and the rule in words", () => {
    const c = show("two-rater");
    expect(within(c).getByRole("heading", { name: "AARON" })).toBeTruthy();
    expect(within(c).getByRole("heading", { name: "R7" })).toBeTruthy();
    expect(within(c).getByTestId("test1-verdict").textContent).toBe("Supported");
    expect(text(c)).toContain("both raters' exact one-sided p of 0.05 or lower");
    expect(text(c)).toMatch(/Agreement.*burst 1\.00.*push 1\.00/);
    expect(text(c)).not.toContain("provisional");
    const c2 = show("two-rater", (t) => { t.verdict = "not supported"; t.raters.R7.primary.p_le_0_05 = false; });
    expect(within(c2).getAllByTestId("test1-verdict").pop()!.textContent).toBe("Not supported");
  });

  it("fallback: not tested by two raters, AARON tagged author-rated, no verdict, the deadline", () => {
    const c = show("fallback");
    expect(text(c)).toContain("Not tested by two raters");
    expect(within(c).getAllByText("author-rated").length).toBeGreaterThan(0);
    expect(within(c).queryByTestId("test1-verdict")).toBeNull();
    expect(text(c)).toContain("2026-11-15");
    expect(text(c)).not.toMatch(/\bsupported\b/i);
  });

  it("every state: a table per rater in league order with Wilson intervals, steadiness and n", () => {
    const c = show("two-rater");
    const tables = within(c).getAllByRole("table");
    expect(tables.length).toBeGreaterThanOrEqual(2);
    const t = tables[0];
    expect(within(t).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Engine", "n", "Misses", "Miss rate", "Wilson 95 % interval", "Steadiness"]);
    const rows = within(t).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.querySelector("td")!.textContent)).toEqual(["Wan 2.2", "Gen-4 Turbo", "LTX-2.3", "Gen-4.5", "H3"]);
    expect(rows[0].textContent).toContain("22");
    expect(rows[0].textContent).toContain("18");
    expect(rows[0].textContent).toContain("0.82");
    expect(rows[0].textContent).toContain("0.61 to 0.93");
    expect(rows[0].textContent).toContain("0.84 px");
  });

  it("More: sensitivity, the within-row check and the motion AUC with the writer's reading", () => {
    const c = show("pending");
    const more = c.querySelector("details")!;
    expect(more.querySelector("summary")!.textContent).toBe("More");
    expect(more.textContent).toContain("score \u2264 3");
    expect(more.textContent).toMatch(/Within-row check/);
    expect(more.textContent).toContain("corroborates: the misses are under-animated");
  });

  it("fallback with late R7 files: both raters tagged author-rated, kappa shown, no verdict", () => {
    const c = show("fallback-late");
    expect(within(c).getByRole("heading", { name: "R7" })).toBeTruthy();
    expect(within(c).getAllByText("author-rated")).toHaveLength(2);
    expect(within(c).queryByTestId("test1-verdict")).toBeNull();
    expect(text(c)).toContain("Not tested by two raters");
    expect(text(c)).toMatch(/Agreement.*burst 1\.00.*push 1\.00/);
    expect(text(c)).not.toMatch(/\bsupported\b/i);
    expect(within(c).getAllByRole("img")).toHaveLength(2);
  });

  it("the R7 declaration: present perfect while pending, past once rated, silent when unknown", () => {
    expect(text(show("pending"))).toContain("R7 has declared not having seen the explorer, the release or these clips.");
    cleanup();
    expect(text(show("two-rater"))).toContain("R7 declared not having seen the explorer, the release or these clips before rating.");
    cleanup();
    expect(text(show("fallback-late"))).toContain("R7 declared not having seen the explorer, the release or these clips before rating.");
    cleanup();
    let c = show("two-rater", (t) => { t.r7_blind_to_engine_styles = false; });
    expect(text(c)).toContain("R7 declared prior exposure (see the amendment).");
    expect(text(c)).not.toContain("not having seen");
    cleanup();
    c = show("pending", (t) => { t.r7_blind_to_engine_styles = false; });
    expect(text(c)).toContain("R7 has declared prior exposure (see the amendment).");
    cleanup();
    c = show("two-rater", (t) => { t.r7_blind_to_engine_styles = null; });
    expect(text(c)).not.toMatch(/declared|prior exposure/);
  });

  it("shows the partial note", () => {
    const c = show("fallback", (t) => { t.partial_note = "R7 exported the burst study only."; });
    expect(text(c)).toContain("R7 exported the burst study only.");
  });

  it("an interval plot per rater with a full label", () => {
    const c = show("two-rater");
    const plots = within(c).getAllByRole("img");
    expect(plots).toHaveLength(2);
    expect(plots[0].getAttribute("aria-label")).toMatch(/Wan 2\.2 0\.82, interval 0\.61 to 0\.93/);
  });

  it("every number sits under the exploratory chip's section", () => {
    const c = show("two-rater");
    const nums = [...c.querySelectorAll(".num")];
    expect(nums.length).toBeGreaterThan(20);
    expect(nums.filter((n) => !n.closest("[data-a9]"))).toEqual([]);
    expect(within(c).getByText("Exploratory, post-hoc · A9")).toBeTruthy();
  });
});


describe("Writeup", () => {
  const blocks = parseThesis("# Title\n\nThe **first** paragraph, with [the plain page](https://stilldrawn.studionephele.com/tax).\n\n## Part\n\n- one\n- two\n");
  it("draws h2, paragraphs, lists and links, skips the h1, and adds the four source links, the results record between the plan and the code", () => {
    render(<Writeup blocks={blocks} repo="https://github.com/example/stilldrawn" />);
    expect(screen.getByRole("heading", { level: 3, name: "Part" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Title" })).toBeNull();
    expect(screen.getAllByRole("listitem").map((x) => x.textContent).slice(0, 2)).toEqual(["one", "two"]);
    expect(screen.getByRole("link", { name: "the plain page" }).getAttribute("href")).toBe("/tax");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs.slice(-4)).toEqual([
      "https://github.com/example/stilldrawn/blob/a9-registered/docs/PREREGISTRATION.md",
      "https://github.com/example/stilldrawn/blob/main/docs/PREREGISTRATION.md",
      "https://github.com/example/stilldrawn/blob/a9-registered/metrics/masked.py",
      "https://github.com/example/stilldrawn/blob/main/analysis/out/a9_masked_drift.json",
    ]);
    expect(screen.getAllByRole("link").slice(-4).map((a) => a.textContent)).toEqual(["The registered plan (A9)", "The results record", "The code", "The data"]);
  });
  it("refuses a figure: there are none in v1", () => {
    const fig = parseThesis("# T\n\n![alt](web/public/thesis/x-light.png)\n\n*Figure 1: caption*\n");
    // called as a function: React 19 reports a render error to the console instead of throwing from render()
    expect(() => Writeup({ blocks: fig, repo: "https://github.com/example/stilldrawn" })).toThrow(/figure/i);
  });
});
