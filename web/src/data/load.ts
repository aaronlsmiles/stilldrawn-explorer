// Fetch the contract once per page; series per engine on demand.
import type { Clip, Core, Engine, Index, Panel, Paper, Series, Taxonomy } from "./types";

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
    get<Clip[]>("clips.json"), get<Paper>("paper.json"), get<Taxonomy>("taxonomy.json"),
  ]).then(([index, engines, panels, clips, paper, taxonomy]) => {
    const e = new Map(engines.map((x) => [x.id, x])), p = new Map(panels.map((x) => [x.id, x])), c = new Map(clips.map((x) => [x.id, x]));
    return { index, engines, panels, clips, paper, taxonomy, engine: (id) => e.get(id)!, panel: (id) => p.get(id), clip: (id) => c.get(id) };
  });
  core.catch(() => (core = null)); // a failed load can be retried
  return core;
}

const series = new Map<string, Promise<Record<string, Series>>>();
export function loadSeries(engine: string) {
  if (!series.has(engine)) {
    const p = get<Record<string, Series>>(`series/${engine}.json`);
    p.catch(() => series.delete(engine));
    series.set(engine, p);
  }
  return series.get(engine)!;
}
