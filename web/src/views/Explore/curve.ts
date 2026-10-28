import type { SeriesKey } from "../../data/types";

/**
 * Frame index of each series' first sample and its stride (pipeline series.py):
 * line, IoU, style and tone compare frame t with frame 0, so they start at 1;
 * edge and closure are per frame from 0; motion is RAFT on every second frame pair.
 */
export function seriesFrames(key: SeriesKey): { start: number; step: number } {
  if (key === "motion") return { start: 1, step: 2 };
  if (key === "edge" || key === "closure") return { start: 0, step: 1 };
  return { start: 1, step: 1 };
}

export function valueAtFrame(values: number[], key: SeriesKey, frame: number): number | null {
  const { start, step } = seriesFrames(key);
  if (frame < start) return null;
  const i = Math.min(values.length - 1, Math.floor((frame - start) / step));
  return values[i] ?? null;
}
