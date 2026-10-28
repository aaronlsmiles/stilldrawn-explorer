import { it, expect } from "vitest";
import { seriesFrames, valueAtFrame } from "./curve";
it("aligns each series to frame indices", () => {
  expect(seriesFrames("line")).toEqual({ start: 1, step: 1 });
  expect(seriesFrames("edge")).toEqual({ start: 0, step: 1 });
  expect(seriesFrames("motion")).toEqual({ start: 1, step: 2 });
});
it("reads the value shown at a frame (the last sample at or before it)", () => {
  expect(valueAtFrame([10, 20, 30], "line", 0)).toBeNull();
  expect(valueAtFrame([10, 20, 30], "line", 1)).toBe(10);
  expect(valueAtFrame([10, 20, 30], "line", 3)).toBe(30);
  expect(valueAtFrame([10, 20, 30], "motion", 4)).toBe(20);
  expect(valueAtFrame([10, 20, 30], "edge", 9)).toBe(30);
});
