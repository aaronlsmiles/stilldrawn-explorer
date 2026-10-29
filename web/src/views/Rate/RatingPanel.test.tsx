import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { Study } from "blindpanel";
import { RatingPanel } from "./RatingPanel";

const study = JSON.parse(readFileSync("public/data/blindpanel/stilldrawn/study.json", "utf8")) as Study;
const KEY = `blindpanel:${study.id}:${study.instrument}`;
const tick = () => new Promise((r) => setTimeout(r, 50));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("RatingPanel", () => {
  it("mounts exactly one session under StrictMode and removes it on unmount", async () => {
    const { container, unmount } = render(<StrictMode><RatingPanel study={study} studyUrl="/s/study.json" /></StrictMode>);
    await tick();
    expect(container.querySelectorAll('[data-bp="session"]')).toHaveLength(1);
    unmount();
    expect(document.querySelectorAll('[data-bp="session"]')).toHaveLength(0);
  });
  it("keeps one saved session across the StrictMode remount", async () => {
    render(<StrictMode><RatingPanel study={study} studyUrl="/s/study.json" /></StrictMode>);
    await tick();
    expect(Object.keys(localStorage).filter((k) => k.startsWith("blindpanel:"))).toEqual([KEY]);
    const first = JSON.parse(localStorage.getItem(KEY)!).session;
    cleanup();
    render(<StrictMode><RatingPanel study={study} studyUrl="/s/study.json" /></StrictMode>);
    await tick();
    expect(JSON.parse(localStorage.getItem(KEY)!).session).toBe(first);
  });
});
