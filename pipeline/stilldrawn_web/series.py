"""Per-frame series for the drift curve, rounded for the web.

Index conventions (checked across all 373 clips):
  line, iou, style   n_frames - 1 values: frames 1..n-1 compared with frame 0
  edge, closure      n_frames values: frames 0..n-1
  tone               n_frames values, or None (no usable tiles on 54 clips)
  motion             one value per pair of sampled frames (stride 2): 60, or 61 for H3's 124-frame clips
"""
import json
import math

SIG_FIGS = 4
FRAME_OFFSET = {"line": 1, "iou": 1, "style": 1, "edge": 0, "closure": 0, "tone": 0}
MOTION_STRIDE = 2


def round_sig(x, sig: int = SIG_FIGS):
    if x is None or (isinstance(x, float) and not math.isfinite(x)):
        return None
    if x == 0:
        return 0.0
    return round(x, sig - 1 - int(math.floor(math.log10(abs(x)))))


def _r(values):
    return None if values is None else [round_sig(float(v)) for v in values]


def series(metrics_json: dict, motion_json: dict) -> dict:
    m = metrics_json["metrics"]
    v0 = m["line_drift"]["vs_frame0"]
    return {
        "line": _r(v0["chamfer_series"]),
        "iou": _r(v0["iou_series"]),
        "edge": _r(m["edge_decay"]["series"]),
        "style": _r(m["style_drift"].get("series")),
        "closure": _r(m["closure_proxy"]["series"]),
        "tone": _r(m["tone_spectral_drift"].get("series")),
        "motion": _r(motion_json["motion"]["series"]),
    }


def clip_series(clip) -> dict:
    return series(json.loads(clip.metrics_path.read_text()), json.loads(clip.motion_path.read_text()))
