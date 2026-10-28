import { it, expect } from "vitest";
import { frameAt, frameOfMediaTime, timeFor, wrap } from "./useFrameClock";
it("maps times to frames and back to mid-frame times", () => {
  expect(frameAt(0, 24)).toBe(0);
  expect(frameAt(1.0, 24)).toBe(24);
  expect(frameAt(timeFor(96, 24), 24)).toBe(96);
  expect(timeFor(0, 24)).toBeCloseTo(1 / 48, 12);
  expect(frameOfMediaTime(96 / 24, 24)).toBe(96);
  expect(frameOfMediaTime(96 / 24 - 1e-9, 24)).toBe(96);
});
it("wraps frame steps around the loop", () => {
  expect(wrap(-1, 121)).toBe(120);
  expect(wrap(121, 121)).toBe(0);
  expect(wrap(5, 121)).toBe(5);
});
