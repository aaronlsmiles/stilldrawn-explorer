// Derived views of clips.json: the contact-sheet grid, a cell's draws, ranks in the basis.
import type { Clip, Metric } from "./types";

export const ANALYSED = ["gen4.5", "gen4_turbo", "h3-fal", "ltx23", "wan22"] as const;
export const cellKey = (panel: string, motionClass: string) => `${panel}_${motionClass.toLowerCase()}`;
/** A grid row: the cell without its engine suffix (act-tone-2_campush, flint-a--b, ground-…_idle). */
export const rowKeyOf = (c: Clip) => c.cell.slice(0, c.cell.lastIndexOf("_"));

export const ARM_VIEWS = [
  { id: "standard", label: "Standard" },
  { id: "hazard", label: "Hazard (H3)" },
  { id: "ground", label: "Ground" },
  { id: "flint", label: "FLINT" },
  { id: "seedance", label: "Seedance" },
] as const;
export type ArmView = (typeof ARM_VIEWS)[number]["id"];
export const isArmView = (s: string | null): s is ArmView => ARM_VIEWS.some((v) => v.id === s);

/**
 * The grid view a clip belongs to. Repeat and hazard draws sit under their primary cell;
 * the four H3 hazard cells that have no primary draw form their own view.
 */
export function viewOf(clips: Clip[]): (c: Clip) => ArmView {
  const primary = new Set(clips.filter((c) => c.arm === "primary").map((c) => c.cell));
  return (c) =>
    c.arm === "primary" || ((c.arm === "repeat" || c.arm === "hazard") && primary.has(c.cell)) ? "standard"
    : c.arm === "hazard" || c.arm === "repeat" ? "hazard"
    : (c.arm as "ground" | "flint" | "seedance");
}

const DRAW_ORDER = (d: string) => (d === "r1" ? 0 : d === "r2" ? 1 : 1 + Number(d.slice(1)));
const byDraw = (a: Clip, b: Clip) => DRAW_ORDER(a.draw) - DRAW_ORDER(b.draw);

/** Clips that head a grid cell in a view: the primary draw, or the first draw where there is none. */
function heads(clips: Clip[], view: ArmView): Clip[] {
  const of = viewOf(clips);
  const pool = clips.filter((c) => of(c) === view);
  const first = new Map<string, Clip>();
  for (const c of [...pool].sort(byDraw)) if (!first.has(c.cell)) first.set(c.cell, c);
  return [...first.values()];
}

export type GridRow = { key: string; panel: string; motion_class: string; cells: { engine: string; clip?: Clip; draws: number }[] };

export function gridRows(clips: Clip[], view: ArmView): GridRow[] {
  const hs = heads(clips, view);
  const cols = view === "standard" ? [...ANALYSED] : [...new Set(hs.map((c) => c.engine))].sort();
  const keys = [...new Set(hs.map(rowKeyOf))].sort();
  return keys.map((key) => {
    const any = hs.find((c) => rowKeyOf(c) === key)!;
    return {
      key, panel: any.panel, motion_class: any.motion_class,
      cells: cols.map((engine) => {
        const clip = hs.find((c) => rowKeyOf(c) === key && c.engine === engine);
        return { engine, clip, draws: clip ? clips.filter((c) => c.cell === clip.cell).length : 0 };
      }),
    };
  });
}

export const drawsOf = (clips: Clip[], cell: string) => clips.filter((c) => c.cell === cell).sort(byDraw);

/** The clip for a row and engine, at a draw (default: the cell's first draw). */
export function clipFor(clips: Clip[], row: string, engine: string, draw?: string | null) {
  const ds = clips.filter((c) => rowKeyOf(c) === row && c.engine === engine).sort(byDraw);
  return (draw && ds.find((c) => c.draw === draw)) || ds[0];
}

/** Rank (1 = lowest value) among the engine's primary standard cells, or null outside the basis. */
export function basisRank(clips: Clip[], clip: Clip, metric: Metric) {
  const v = clip.h[metric];
  if (clip.arm !== "primary" || v == null) return null;
  const pool = clips.filter((c) => c.arm === "primary" && c.engine === clip.engine && c.h[metric] != null);
  return { rank: 1 + pool.filter((c) => c.h[metric]! < v).length, of: pool.length };
}
