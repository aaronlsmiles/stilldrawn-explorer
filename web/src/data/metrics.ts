// Names and units of the five headlines and the per-frame series, from docs/PREREGISTRATION.md §3.
import type { Metric, SeriesKey } from "./types";

export const HEADLINE: Record<Metric, { name: string; unit: string; what: string; dp: "px" | "sig" }> = {
  line: { name: "Line drift", unit: "px", what: "Mean chamfer distance of the line art to frame 0", dp: "px" },
  tone: { name: "Screentone drift", unit: "", what: "Variance of the screentone band energy over the clip", dp: "sig" },
  edge: { name: "Edge decay", unit: "", what: "Normalised slope of edge strength, as a magnitude", dp: "sig" },
  style: { name: "Style drift", unit: "", what: "Cosine distance of the last frame's DINOv2 embedding to frame 0", dp: "sig" },
  closure: { name: "Line closure", unit: "", what: "Change in open line ends by the last frame", dp: "sig" },
};

export const SERIES: Record<Exclude<SeriesKey, "motion">, { name: string; axis: string }> = {
  line: { name: "Line drift", axis: "Chamfer to frame 0 (px)" },
  iou: { name: "Line IoU", axis: "IoU with frame 0" },
  edge: { name: "Edge strength", axis: "Edge strength (p95 gradient)" },
  style: { name: "Style drift", axis: "Cosine distance to frame 0" },
  closure: { name: "Line closure", axis: "Open line ends per line pixel" },
  tone: { name: "Screentone", axis: "Screentone band energy" },
};

export const MOTION_WORDS: Record<string, string> = { IDLE: "Idle", BURST: "Burst", CAMPUSH: "Camera push", FLINT: "FLINT pair" };
