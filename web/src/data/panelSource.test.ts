import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { panelSource } from "./panelSource";
import type { Panel } from "./types";

const panels: Panel[] = JSON.parse(readFileSync("public/data/v1/panels.json", "utf8"));
const byId = (id: string) => panels.find((p) => p.id === id)!;

describe("panelSource: the model that made each source panel, worded as the release's NOTICE-PROVIDERS.md", () => {
  it.each([
    ["act-black-1", "Google Gemini 2.5 Flash Image, via the Runway API"],
    ["act-tone-2", "Illustrious-XL v0.1, run locally"],
    ["ground-cu-line-1-v052", "A variant of cu-line-1 (Google Gemini 2.5 Flash Image, via the Runway API)"],
  ])("%s", (id, text) => {
    expect(panelSource(byId(id), byId)).toBe(text);
  });
  it("the two panels from the author's own chain", () => {
    const own = panels.filter((p) => p.source_engine === "private-production-chain");
    expect(own).toHaveLength(2);
    for (const p of own) expect(panelSource(p, byId)).toBe("The author's private production chain");
  });
  it("every panel in the contract has a source the explorer can name", () => {
    for (const p of panels) expect(() => panelSource(p, byId), p.id).not.toThrow();
  });
});
