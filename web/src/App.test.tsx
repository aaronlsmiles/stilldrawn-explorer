import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { stubResizeObserver } from "./test/maskedKit";
import { App } from "./App";

const h = vi.hoisted(() => ({ published: false, core: null as any, masked: 0 }));
vi.mock("./data/load", async () => {
  const kit = await import("./test/maskedKit");
  return {
    loadCore: () => (h.core ??= Promise.resolve(kit.makeCore(h.published))),
    loadMasked: () => { h.masked++; return Promise.resolve(kit.fixture("pending")); },
    loadSeries: () => Promise.resolve({}), retrySeries: () => {},
  };
});

async function at(path: string, published: boolean) {
  h.published = published; h.core = null; h.masked = 0;
  history.replaceState(null, "", path);
  await act(async () => { render(<App />); });
}
beforeEach(() => { stubResizeObserver(); (window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); });
afterEach(cleanup);

describe("router", () => {
  it("/tax/masked is its own page, and /tax stays Stillness Tax", async () => {
    await at("/tax/masked", true);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Drift where nothing should move");
  });
  it("a missing page names the masked view only when it is published", async () => {
    await at("/nowhere", true);
    await screen.findByRole("heading", { level: 1, name: "Not found" });
    expect(screen.getByRole("link", { name: "Drift where nothing should move" }).getAttribute("href")).toBe("/tax/masked");
    cleanup();
    await at("/nowhere", false);
    await screen.findByRole("heading", { level: 1, name: "Not found" });
    expect(screen.queryByRole("link", { name: "Drift where nothing should move" })).toBeNull();
    expect(h.masked).toBe(0);
  });
});
