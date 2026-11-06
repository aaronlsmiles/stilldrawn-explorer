import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { makeCore, stubResizeObserver } from "../../test/maskedKit";
import { CoreProvider } from "../../data/core";
import Tax from "./Tax";

const h = vi.hoisted(() => ({ published: false, core: null as any }));
vi.mock("../../data/load", async () => {
  const kit = await import("../../test/maskedKit");
  return { loadCore: () => (h.core ??= Promise.resolve(kit.makeCore(h.published))), loadMasked: () => { throw new Error("Tax must not request masked.json"); } };
});

async function show(published: boolean) {
  h.published = published; h.core = null;
  history.replaceState(null, "", "/tax");
  await act(async () => { render(<Suspense fallback="loading"><CoreProvider><Tax /></CoreProvider></Suspense>); });
  await screen.findByRole("heading", { level: 1, name: "Stillness Tax" });
}
beforeEach(stubResizeObserver);
afterEach(cleanup);

describe("Stillness Tax links to the masked view only when it is published", () => {
  it("links with the flag on", async () => {
    await show(true);
    const a = screen.getByRole("link", { name: "Drift where nothing should move" });
    expect(a.getAttribute("href")).toBe("/tax/masked");
  });
  it("shows no link with the flag off", async () => {
    await show(false);
    expect(screen.queryByRole("link", { name: /Drift where nothing should move/ })).toBeNull();
    expect(makeCore(false).index.masked).toBe(false);
  });
});
