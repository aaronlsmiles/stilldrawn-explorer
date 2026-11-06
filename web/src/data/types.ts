// The v1 data contract (pipeline/stilldrawn_web/export.py). Shapes only; no values live here.
export type Metric = "line" | "tone" | "edge" | "style" | "closure";
export const METRICS: Metric[] = ["line", "tone", "edge", "style", "closure"];
export type Arm = "primary" | "repeat" | "hazard" | "ground" | "flint" | "seedance";

export type Index = {
  contract: string;
  built_at: string;
  source: { doi_version: string; doi_concept: string; repo: string; commit: string | null };
  media_base: string;
  masked: boolean;
  counts: Record<Arm, number>;
  missing_cells: { cell: string; reason: string }[];
  variants: { panels: number[]; posters: number[]; poster_width: number; rule: string };
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
};

// masked.json (P46): the A9 outputs re-shaped by pipeline/stilldrawn_web/masked.py; shapes only.
export type MaskSet = "aaron" | "agent";
export type MarginKey = "m16" | "m32" | "m64";
export type MaskedSplit = "all" | "idle" | "burst";
export type MaskedVerdict = "not testable" | "supported" | "mask-dependent" | "killed" | "not supported";
export type MaskedCondition = {
  n_clips: Record<string, number>; D_whole_px: Record<string, number | null>; D_masked_px: Record<string, number | null>;
  ratio_whole: number | null; ratio_masked: number | null; s: number | null; s_ci95: [number, number] | null;
  kendall_tau_b: number | null; n_unscorable_masked: Record<string, number>; n_unscorable_whole: Record<string, number>;
  n_m_empty: Record<string, number>; n_excluded: number; n_s_finite: number; n_g_whole_le_0: number;
};
export type MaskedCell = { px: number | null; unscorable: boolean; f0: number; region_frac: number };
export type MaskedClip = {
  clip: string; mapping: "stretch" | "centre-crop"; whole_px: number | null; whole_unscorable: boolean;
  masked: Record<MaskSet, Record<MarginKey, MaskedCell>>;
};
export type MaskedRow = {
  row: string; panel: string; motion: "idle" | "burst"; panel_px: [number, number]; eligible: boolean; iou: number;
  status: Record<MaskSet, "drawn" | "nothing-allowed">;
  polygons: Record<MaskSet, [number, number][][]>;
  clips: Record<string, MaskedClip>;
};
export type Wilson = [number, number];
export type RaterPrimary = {
  miss?: string;
  per_engine: Record<string, { n: number; misses: number; miss_rate: number; wilson95: Wilson }>;
  rho: number | null; p_one_sided: number | null; p_le_0_05: boolean;
};
// the writer's other per-rater blocks pass through untyped here; the Test 1 panel narrows what it draws
export type MaskedRater = { primary: RaterPrimary; provisional?: string | null; [block: string]: unknown };
export type MaskedTest1 = {
  state: "pending" | "two-rater" | "fallback"; label: string; basis: string; verdict: "supported" | "not supported" | null;
  h1_reading: string | null; steadiness_px: Record<string, number>; attainable_p_no_ties: [number, number][];
  raters: { AARON: MaskedRater; R7: MaskedRater | null };
  kappa: Record<string, number | null> | null; r7_deadline: string; r7_blind_to_engine_styles: boolean | null; partial_note: string | null;
};
export type Masked = {
  schema: "stilldrawn-explorer-masked/1";
  provenance: { synthetic: boolean; release_commit: string | null; sources_sha256: Record<string, string> };
  status: string; engine_order: string[];
  test2: {
    verdict: MaskedVerdict; n_eligible_rows: number; min_f0_line_px_in_R: number;
    bootstrap: { B: number; seed: number; unit: string };
    headline_md: Record<MaskSet, string>;
    conditions: Record<MaskedSplit, Record<MaskSet, Record<MarginKey, MaskedCondition>>>;
  };
  test1: MaskedTest1;
  masks: Record<MaskSet, { drawn_by: string; rule: string }>;
  rows: MaskedRow[];
};
