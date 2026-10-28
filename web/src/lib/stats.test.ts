import { describe, it, expect } from "vitest";
import { median, nanmedian, percentile, rank, pearson, spearman, spearmanExact } from "./stats";

describe("stats", () => {
  it("median of odd and even", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("nanmedian skips NaN", () => expect(nanmedian([NaN, 1, 3])).toBe(2));
  it("percentile matches numpy 'linear'", () => {
    // numpy.percentile([1,2,3,4,10], [25, 75]) == [2., 4.]; numpy.percentile([0,10], 33) == 3.3
    expect(percentile([1, 2, 3, 4, 10], 25)).toBe(2);
    expect(percentile([1, 2, 3, 4, 10], 75)).toBe(4);
    expect(percentile([0, 10], 33)).toBeCloseTo(3.3, 12);
  });
  it("rank averages ties", () => expect(rank([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1]));
  it("pearson of a line is 1", () => expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12));
  it("spearman is pearson of ranks", () => expect(spearman([1, 2, 3, 4], [1, 3, 2, 4])).toBeCloseTo(0.8, 12));
  it("exact p for n = 5, rho = 0.9 is 1/12", () => {
    const [rho, p] = spearmanExact([1, 2, 3, 4, 5], [1, 3, 2, 4, 5]);
    expect(rho).toBeCloseTo(0.9, 12);
    expect(p).toBeCloseTo(1 / 12, 12);
  });
});
