// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { preloadScript } from "./panel-preload";
import { PANEL_SIZES, srcset } from "../src/data/srcset";
import { DEFAULT } from "../src/views/Explore/defaults";

const d = { base: "https://m/", widths: [320, 640, 960], own: { "act-tone-2": 1344, "cip-act-tank-1": 1024 }, cell: DEFAULT.cell, sizes: PANEL_SIZES };
afterEach(() => document.head.replaceChildren());

function run(path: string) {
  history.replaceState(null, "", path);
  new Function(preloadScript(d))();
  return document.head.querySelector<HTMLLinkElement>("link[rel=preload][as=image]");
}
const img = (id: string, own: number) => srcset((p) => d.base + p, `panels/${id}.webp`, own, d.widths);

test("the bare /explore preloads the default panel, as the compare <img> will ask for it", () => {
  const l = run("/explore")!;
  expect(l.getAttribute("imagesrcset")).toBe(img("act-tone-2", 1344));
  expect(l.getAttribute("imagesizes")).toBe(PANEL_SIZES.compare);
  expect(l.getAttribute("fetchpriority")).toBe("high");
});

test("a deep link preloads its own panel, single unless it names a second engine", () => {
  expect(run("/explore?cell=cip-act-tank-1_burst&e=gen4.5")!.getAttribute("imagesrcset")).toBe(img("cip-act-tank-1", 1024));
  document.head.replaceChildren();
  expect(run("/explore?cell=cip-act-tank-1_burst&e=gen4.5")!.getAttribute("imagesizes")).toBe(PANEL_SIZES.single);
  document.head.replaceChildren();
  expect(run("/explore?cell=act-tone-2_idle&e=gen4.5&vs=wan22")!.getAttribute("imagesizes")).toBe(PANEL_SIZES.compare);
});

test("nothing is preloaded where no panel will show", () => {
  for (const p of ["/explore?arm=ground", "/explore/failures", "/tax", "/explore?cell=nope_idle"]) {
    expect(run(p), p).toBeNull();
  }
});
