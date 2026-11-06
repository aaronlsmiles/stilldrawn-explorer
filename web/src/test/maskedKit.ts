// Test kit for the masked-drift view: a Core built from the checked-in v1 data, and the four
// synthetic masked.json states. Tests only; nothing in the app imports this.
import indexJson from "../../public/data/v1/index.json";
import enginesJson from "../../public/data/v1/engines.json";
import panelsJson from "../../public/data/v1/panels.json";
import clipsJson from "../../public/data/v1/clips.json";
import paperJson from "../../public/data/v1/paper.json";
import taxonomyJson from "../../public/data/v1/taxonomy.json";
import basisJson from "../../public/data/v1/basis.json";
import pending from "../views/Tax/__fixtures__/masked-pending.json";
import twoRater from "../views/Tax/__fixtures__/masked-two-rater.json";
import fallback from "../views/Tax/__fixtures__/masked-fallback.json";
import fallbackLate from "../views/Tax/__fixtures__/masked-fallback-late.json";
import type { BasisRow, Clip, Core, Engine, Index, Masked, Panel, Paper, Taxonomy } from "../data/types";

export type MaskedStateName = "pending" | "two-rater" | "fallback" | "fallback-late";
const FIXTURES = { pending, "two-rater": twoRater, fallback, "fallback-late": fallbackLate } as unknown as Record<MaskedStateName, Masked>;
export const fixture = (state: MaskedStateName = "pending"): Masked => structuredClone(FIXTURES[state]);

export function makeCore(masked: boolean): Core {
  const index = { ...(indexJson as unknown as Index), masked };
  const engines = enginesJson as unknown as Engine[], panels = panelsJson as unknown as Panel[], clips = clipsJson as unknown as Clip[];
  const e = new Map(engines.map((x) => [x.id, x])), p = new Map(panels.map((x) => [x.id, x])), c = new Map(clips.map((x) => [x.id, x]));
  return {
    basis: basisJson as unknown as BasisRow[], index, engines, panels, clips,
    paper: paperJson as unknown as Paper, taxonomy: taxonomyJson as unknown as Taxonomy,
    engine: (id) => e.get(id)!, panel: (id) => p.get(id), clip: (id) => c.get(id),
  };
}

/** jsdom has no ResizeObserver; the charts only need it to exist. */
export function stubResizeObserver() {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
}
