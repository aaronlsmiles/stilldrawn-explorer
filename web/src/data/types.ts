// The v1 data contract (pipeline/stilldrawn_web/export.py). Shapes only; no values live here.
export type Metric = "line" | "tone" | "edge" | "style" | "closure";
export const METRICS: Metric[] = ["line", "tone", "edge", "style", "closure"];
export type Arm = "primary" | "repeat" | "hazard" | "ground" | "flint" | "seedance";

export type Index = {
  contract: string;
  built_at: string;
  source: { doi_version: string; doi_concept: string; repo: string; commit: string | null };
  media_base: string;
  counts: Record<Arm, number>;
  missing_cells: { cell: string; reason: string }[];
};

export type Engine = {
  id: string; name: string; provider: string; access: "hosted" | "local";
  in_analysis: boolean; model_version: string | null; notice: boolean; zip: string;
};

export type Panel = {
  id: string; content_class: string; treatment: string; width: number; height: number;
  source_engine: string; derived_from: string | null; notice: boolean; alt: string;
  media: { png: string; webp: string };
};

export type Clip = {
  id: string; cell: string; panel: string; motion_class: string; engine: string;
  arm: Arm; draw: string; flint_pair: [string, string] | null;
  fps: number; n_frames: number; width: number; height: number; bytes: number; sha256: string; c2pa: boolean;
  media: { mp4: string; poster: string; frame0: string };
  h: Record<Metric, number | null>;
  motion: { median_norm: number; median_px: number };
  departed: boolean;
  tags: string[];
};

export type Series = {
  line: number[]; iou: number[]; edge: number[]; style: number[]; closure: number[];
  tone: number[] | null; motion: number[];
};
export type SeriesKey = keyof Series;

export type Mode = { name: string; axis: string; definition: string; clips: string[]; candidate?: boolean };
export type Taxonomy = Record<string, Mode>;

type Src<T> = { value: T; source: string };
type Rho = { rho: number; p: number; n: number };
export type Paper = {
  doi_version: Src<string>;
  doi_concept: Src<string>;
  n_clips: Src<number>;
  n_clips_by_arm: Src<Record<Arm, number>>;
  league_drift_median_px: Src<Record<string, number>>;
  motion_median_norm: Src<Record<string, number>>;
  basis_n: Src<Record<string, number>>;
  gen45_motion_vs_wan22: Src<number>;
  gen45_motion_vs_gen4_turbo: Src<number>;
  engine_rho_motion_drift: Src<{ rho: number; p_exact_two_sided: number; n_engines: number }>;
  pareto: Src<{ frontier: string[]; dominated_by: Record<string, string[]> }>;
  pairwise_bands: Src<{ overlapping: number; usable: number; reversals: string[]; min_n: number }>;
  within_engine_rho: Src<Record<string, Record<Metric, Rho>>>;
  pooled_rho: Src<Record<Metric, Rho>>;
  price_crossovers: Src<{ p_from: number; p_to: number; leader: string }[]>;
  alpha_ordinal: Src<{ register: number; sameness: number }>;
  departure_threshold_px: Src<number>;
  status_motion: Src<string>;
};

export type BasisRow = { id: string; engine: string; motion: number; drift: number | null };
export type Core = {
  basis: BasisRow[];
  index: Index; engines: Engine[]; panels: Panel[]; clips: Clip[]; paper: Paper; taxonomy: Taxonomy;
  engine: (id: string) => Engine;
  panel: (id: string) => Panel | undefined;
  clip: (id: string) => Clip | undefined;
  /** False only in a preview build that ships a subset of the clips (VITE_MEDIA_SUBSET). */
  streamable: (id: string) => boolean;
};
