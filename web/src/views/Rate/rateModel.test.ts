// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Reveal } from "blindpanel";
import { clipFor, gridRows } from "../../data/model";
import type { Clip } from "../../data/types";
import { localiseReveal, studyRelative, SITE_ORIGIN } from "./rateModel";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../../public/${p}`, import.meta.url), "utf8"));
const item = (link?: string) => ({ label: "X", meta: {}, ...(link ? { link } : {}) });

describe("rateModel", () => {
  it("rewrites the site's own links to in-app paths and leaves other links alone", () => {
    const r = localiseReveal({ study: "s", reference: null, items: {
      a: item(`${SITE_ORIGIN}/explore?cell=c_idle&e=wan22`),
      b: item("https://doi.org/10.5281/zenodo.23072784"),
      c: item(),
    } } satisfies Reveal);
    expect(r.items.a.link).toBe("/explore?cell=c_idle&e=wan22");
    expect(r.items.b.link).toBe("https://doi.org/10.5281/zenodo.23072784");
    expect(r.items.c.link).toBeUndefined();
  });
  it("resolves study-relative endpoints against the study URL", () => {
    expect(studyRelative("/data/blindpanel/stilldrawn/study.json", "reveal.json")).toBe("/data/blindpanel/stilldrawn/reveal.json");
    expect(studyRelative("/data/blindpanel/stilldrawn/study.json", "/api/submit")).toBe("/api/submit");
  });
  it("every revealed clip opens a real clip in Explore", () => {
    const reveal = localiseReveal(read("data/blindpanel/stilldrawn/reveal.json"));
    const clips: Clip[] = read("data/v1/clips.json");
    const rows = gridRows(clips, "standard");
    const links = Object.values(reveal.items).map((i) => i.link).filter(Boolean) as string[];
    expect(links).toHaveLength(20);
    for (const l of links) {
      const u = new URL(l, "http://x");
      expect(u.pathname).toBe("/explore");
      const cell = u.searchParams.get("cell")!, e = u.searchParams.get("e")!;
      expect(rows.some((r) => r.key === cell), cell).toBe(true);
      expect(clipFor(clips, cell, e), `${cell} ${e}`).toBeDefined();
    }
  });
});
