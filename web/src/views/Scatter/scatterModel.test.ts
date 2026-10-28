import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { points, medianCross } from "./scatterModel";
import type { Clip } from "../../data/types";
import type { BasisRow } from "../../lib/lenses";

const clips: Clip[] = JSON.parse(readFileSync("public/data/v1/clips.json", "utf8"));
const basis: BasisRow[] = JSON.parse(readFileSync("public/data/v1/basis.json", "utf8"));
const fx = JSON.parse(readFileSync("src/lib/__fixtures__/lenses.json", "utf8"));

it("the primary arm is 164 standard points plus 6 FLINT", () => {
  const p = points(clips, basis, "line", new Set(["primary"]));
  expect(p.filter((d) => !d.flint).length).toBe(164);
  expect(p.filter((d) => d.flint).length).toBe(6);
});
it("other arms add their clips", () => {
  expect(points(clips, basis, "line", new Set(["primary", "repeat"])).length).toBe(170 + 98);
});
it("tone points skip clips with no tone headline", () => {
  const p = points(clips, basis, "tone", new Set(["primary"]));
  expect(p.every((d) => d.y > 0)).toBe(true);
  expect(p.length).toBeLessThan(170);
});
it("median cross for line drift matches the lens summary exactly", () => {
  for (const e of Object.keys(fx.summary)) {
    const m = medianCross(points(clips, basis, "line", new Set(["primary"])), e)!;
    expect(Math.abs(m.y - fx.summary[e].drift_median_px)).toBeLessThan(1e-9);
    expect(Math.abs(m.x - fx.summary[e].motion_median_norm)).toBeLessThan(1e-9);
    expect(Math.abs(m.x25 - fx.summary[e].motion_iqr[0])).toBeLessThan(1e-9);
    expect(m.n).toBe(fx.summary[e].n);
  }
});
