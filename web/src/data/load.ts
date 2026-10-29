// Fetch the contract once per page; series per engine on demand.
import type { BasisRow, Clip, Core, Engine, Index, Panel, Paper, Series, Taxonomy } from "./types";

const BASE = "/data/v1/";
const get = async <T,>(path: string): Promise<T> => {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json() as Promise<T>;
};

let core: Promise<Core> | null = null;
export function loadCore(): Promise<Core> {
  core ??= Promise.all([
    get<Index>("index.json"), get<Engine[]>("engines.json"), get<Panel[]>("panels.json"),
    get<Clip[]>("clips.json"), get<Paper>("paper.json"), get<Taxonomy>("taxonomy.json"), get<BasisRow[]>("basis.json"),
  ]).then(([index, engines, panels, clips, paper, taxonomy, basis]) => {
    const e = new Map(engines.map((x) => [x.id, x])), p = new Map(panels.map((x) => [x.id, x])), c = new Map(clips.map((x) => [x.id, x]));
    return { basis, index, engines, panels, clips, paper, taxonomy, engine: (id) => e.get(id)!, panel: (id) => p.get(id), clip: (id) => c.get(id) };
  });
  // a failure stays cached: resetting it here made every render request the file again
  // (1,779 requests in 3 s); the error screen's Retry reloads the page
  return core;
}

const series = new Map<string, Promise<Record<string, Series>>>();
export function loadSeries(engine: string) {
  if (!series.has(engine)) {
    series.set(engine, get<Record<string, Series>>(`series/${engine}.json`));
  }
  return series.get(engine)!;
}
/** Forget a failed series so the curve's Retry fetches it again. */
export const retrySeries = (...engines: string[]) => engines.forEach((e) => series.delete(e));
