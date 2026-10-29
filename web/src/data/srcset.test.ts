import { expect, test } from "vitest";
import { PHONE, srcset, variant } from "./srcset";

const url = (p: string) => "https://m/" + p;

test("the contract's rule names each width beside the display copy", () => {
  expect(variant("panels/act-tone-2.webp", 640)).toBe("panels/act-tone-2-w640.webp");
  expect(variant("posters/act-tone-2_campush_gen45-r2.webp", 320)).toBe("posters/act-tone-2_campush_gen45-r2-w320.webp");
});

test("a set lists the widths below the item's own, then the display copy at its own width", () => {
  expect(srcset(url, "panels/a.webp", 1344, [320, 640, 960]))
    .toBe("https://m/panels/a-w320.webp 320w, https://m/panels/a-w640.webp 640w, https://m/panels/a-w960.webp 960w, https://m/panels/a.webp 1344w");
  expect(srcset(url, "panels/b.webp", 640, [320, 640, 960])).toBe("https://m/panels/b-w320.webp 320w, https://m/panels/b.webp 640w");
});

test("a phone's set stops at 960 px, so a 3x phone takes the 960 copy, not the 1344 original", () => {
  expect(srcset(url, "panels/a.webp", 1344, [320, 640, 960], PHONE.max))
    .toBe("https://m/panels/a-w320.webp 320w, https://m/panels/a-w640.webp 640w, https://m/panels/a-w960.webp 960w");
  expect(srcset(url, "panels/b.webp", 640, [320, 640, 960], PHONE.max)).toBe("https://m/panels/b-w320.webp 320w, https://m/panels/b.webp 640w");
});
