import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { gridRows, drawsOf, cellKey, basisRank, ARM_VIEWS, clipFor, rowKeyOf, viewOf } from "./model";
import type { Clip, Index } from "./types";

const clips: Clip[] = JSON.parse(readFileSync("public/data/v1/clips.json", "utf8"));
const index: Index = JSON.parse(readFileSync("public/data/v1/index.json", "utf8"));

describe("model", () => {
  it("standard grid is 33 rows × 5 engines with one refused slot", () => {
    const rows = gridRows(clips, "standard");
    expect(rows.length).toBe(33);
    expect(rows[0].cells.map((c) => c.engine)).toEqual(["gen4.5", "gen4_turbo", "h3-fal", "ltx23", "wan22"]);
    const missing = rows.flatMap((r) => r.cells.filter((c) => !c.clip).map((c) => `${r.key}|${c.engine}`));
    expect(missing).toEqual(["cu-tone-3_idle|gen4_turbo"]);
    expect(index.missing_cells[0].cell).toBe("cu-tone-3_idle_gen4t");
  });
  it("other arm views have rows", () => {
    expect(gridRows(clips, "ground").length).toBeGreaterThan(0);
    expect(gridRows(clips, "flint").length).toBe(6);
    expect(gridRows(clips, "hazard").map((r) => r.key)).toEqual(["act-black-3_idle", "act-line-2_idle", "cu-black-3_idle", "cu-line-1_burst"]);
    expect(gridRows(clips, "seedance").flatMap((r) => r.cells).every((c) => c.engine === "seedance")).toBe(true);
  });
  it("draws of a primary cell include its repeat and hazard draws", () => {
    const d = drawsOf(clips, "act-black-3_burst_h3").map((c) => c.draw);
    expect(d[0]).toBe("r1");
    expect(d).toContain("h1");
    expect(d).toEqual(["r1", "r2", "h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8"]);
  });
  it("cell keys", () => {
    expect(cellKey("act-tone-2", "CAMPUSH")).toBe("act-tone-2_campush");
    expect(rowKeyOf(clips.find((c) => c.id === "act-tone-2_campush_gen45")!)).toBe("act-tone-2_campush");
  });
  it("clipFor resolves the default compare pair", () => {
    expect(clipFor(clips, "act-tone-2_campush", "gen4.5")?.id).toBe("act-tone-2_campush_gen45");
    expect(clipFor(clips, "act-tone-2_campush", "wan22")?.id).toBe("act-tone-2_campush_wan22");
  });
  it("basis rank is 1-based within the engine's primary standard cells", () => {
    const pool = clips.filter((c) => c.arm === "primary" && c.engine === "wan22");
    const steadiest = pool.sort((a, b) => a.h.line! - b.h.line!)[0];
    expect(basisRank(clips, steadiest, "line")).toEqual({ rank: 1, of: 33 });
    expect(basisRank(clips, clips.find((c) => c.arm === "repeat")!, "line")).toBeNull();
  });
  it("arm views cover all 373 clips exactly once", () => {
    const of = viewOf(clips);
    const n = ARM_VIEWS.reduce((s, v) => s + clips.filter((c) => of(c) === v.id).length, 0);
    expect(n).toBe(373);
    expect(gridRows(clips, "standard").flatMap((r) => r.cells).reduce((s, c) => s + c.draws, 0)
      + gridRows(clips, "hazard").flatMap((r) => r.cells).reduce((s, c) => s + c.draws, 0)).toBe(164 + 98 + 71);
  });
});
