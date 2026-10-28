import { it, expect } from "vitest";
import { px, ratio, norm, ordinal, mb, fixed } from "./format";
it("formats", () => {
  expect(ratio(9.222123151817687)).toBe("9.2×");
  expect(ratio(3.790582767584321)).toBe("3.8×");
  expect(px(0.7798875656772123)).toBe("0.78 px");
  expect(norm(0.0007961275056004524)).toBe("0.00080");
  expect(norm(0.007341985901196797)).toBe("0.0073");
  expect(ordinal(1)).toBe("1st"); expect(ordinal(22)).toBe("22nd"); expect(ordinal(13)).toBe("13th"); expect(ordinal(3)).toBe("3rd");
  expect(mb(26793101)).toBe("26.8 MB");
  expect(fixed(-1.6220306068587647, 2)).toBe("−1.62");
});
