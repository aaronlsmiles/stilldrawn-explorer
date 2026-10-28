"""Write the explorer's data contract (web/public/data/v1) and the web parity fixtures.

    uv run python -m stilldrawn_web.export

Every figure the UI quotes goes into paper.json with its source, so the page
never hard-codes a number.
"""
import json
import os
import struct
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

from . import release_root
from .human import AXES, krippendorff_alpha_ordinal, load_ratings, protocol_text
from .lenses import (MIN_N, REF_ENGINE, band_ranking, floor_ranking, pairwise_bands, pareto,
                     price_crossovers, price_ranking, spearman_exact, summary)
from .load import basis, load_clips
from .series import clip_series, round_sig

CONTRACT = "v1"
MEDIA_VERSION = "v1.0.0"
DOI_VERSION = "10.5281/zenodo.23072784"
DOI_CONCEPT = "10.5281/zenodo.23072783"
REPO = "https://github.com/aaronlsmiles/stilldrawn"
DEPART_PX = 10.0   # frozen A4 rule (a): mean chamfer vs frame 0 > 10 px

HERE = Path(__file__).resolve().parent
WEB = HERE.parent.parent / "web"

ENGINES = {
    "gen4.5":     {"name": "Gen-4.5", "provider": "Runway", "access": "hosted", "in_analysis": True},
    "gen4_turbo": {"name": "Gen-4 Turbo", "provider": "Runway", "access": "hosted", "in_analysis": True},
    "h3-fal":     {"name": "H3", "provider": "MiniMax, via fal", "access": "hosted", "in_analysis": True},
    "wan22":      {"name": "Wan 2.2", "provider": "Wan (open weights, run locally)", "access": "local", "in_analysis": True},
    "ltx23":      {"name": "LTX-2.3", "provider": "Lightricks (open weights, run locally)", "access": "local", "in_analysis": True},
    "seedance":   {"name": "Seedance 2.0", "provider": "ByteDance, via fal", "access": "hosted", "in_analysis": False},
}
# Items covered by the release's NOTICE-PROVIDERS no-training request
NOTICE_ENGINES = {"gen4.5", "gen4_turbo", "h3-fal", "seedance"}

CLASS_WORDS = {"cu": "Close-up", "act": "Action", "est": "Establishing shot"}
TREATMENT_WORDS = {"line": "line only", "tone": "line and screentone", "black": "heavy blacks",
                   "ip-line+tone": "fine line and tone", "chain-black": "heavy blacks, spot whites"}


def _png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as fh:
        head = fh.read(24)
    w, h = struct.unpack(">II", head[16:24])
    return w, h


def _write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n")


def _src(value, source: str) -> dict:
    return {"value": value, "source": source}


def model_versions(root: Path) -> dict:
    mv = {}
    for name in ("manifest.jsonl", "manifest-supplement.jsonl"):
        for line in (root / "runs" / name).read_text().splitlines():
            d = json.loads(line)
            if d.get("model_version"):
                mv.setdefault(d["engine"], d["model_version"])
    return mv


def load_tags() -> dict:
    return yaml.safe_load((HERE / "tags.yaml").read_text())["modes"]


def build_engines(root):
    mv = model_versions(root)
    return [{"id": e, **meta, "model_version": mv.get(e), "notice": e in NOTICE_ENGINES}
            for e, meta in ENGINES.items()]


def build_panels(root):
    meta = json.loads((root / "dataset" / "panel-metadata.json").read_text())
    out = []
    for png in sorted((root / "dataset" / "panels").glob("*.png")):
        pid = png.stem
        recipe = json.loads((root / "dataset" / "recipes" / f"{pid}.json").read_text())
        m = meta.get(pid) or meta.get(recipe.get("derived_from", ""), {})
        cls, treat = m.get("content_class"), m.get("treatment")
        w, h = _png_size(png)
        alt = f"{CLASS_WORDS.get(cls, 'Panel')}, {TREATMENT_WORDS.get(treat, 'ink')}: StillDrawn panel {pid}"
        if recipe.get("engine") == "derived":
            alt += f" (darker paper ground, derived from {recipe['derived_from']})"
        out.append({
            "id": pid, "content_class": cls, "treatment": treat, "width": w, "height": h,
            "source_engine": recipe.get("engine"), "derived_from": recipe.get("derived_from"),
            "notice": recipe.get("engine") in ("hosted", "derived"),
            "alt": alt,
            "media": {"png": f"panels/{pid}.png", "webp": f"panels/{pid}.webp"},
        })
    return out


def build_clips(clips, tags):
    tag_of = defaultdict(list)
    for code, mode in tags.items():
        for cid in mode["clips"]:
            tag_of[cid].append(code)
    rows = []
    for c in clips:
        rows.append({
            "id": c.id, "cell": c.cid.cell, "panel": c.cid.panel, "motion_class": c.cid.motion_class,
            "engine": c.cid.engine, "arm": c.cid.arm, "draw": c.cid.draw,
            "flint_pair": list(c.cid.flint_pair) if c.cid.flint_pair else None,
            "fps": c.fps, "n_frames": c.n_frames, "width": c.width, "height": c.height,
            "bytes": c.bytes, "sha256": c.sha256, "c2pa": c.cid.engine in ("gen4.5", "gen4_turbo", "h3-fal"),
            "media": {"mp4": f"clips/{c.cid.engine}/{c.id}.mp4",
                      "poster": f"posters/{c.id}.webp", "frame0": f"frame0/{c.id}.png"},
            "h": {k: round_sig(v) for k, v in c.h.items()},
            "motion": {"median_norm": round_sig(c.motion_norm), "median_px": round_sig(c.motion_px)},
            "departed": c.h["line"] is not None and c.h["line"] > DEPART_PX,
            "tags": sorted(tag_of.get(c.id, [])) if c.cid.draw == "r1" else [],
        })
    return rows


def build_study(root, clips):
    r = load_ratings(root)
    by_id = {c.id: c for c in clips}
    results = json.loads((root / "analysis/human_check/human_check_results.json").read_text())
    items = []
    for j, cell in enumerate(r["cells"]):
        c = by_id[cell]
        items.append({
            "cell": cell, "panel": c.cid.panel, "engine": c.cid.engine, "motion_class": c.cid.motion_class,
            "motion_norm": c.motion_norm, "h": c.h,
            "ratings": {a: [int(v) for v in r[a][:, j]] for a in AXES},
        })
    return {
        "study_id": "stilldrawn-human-check",
        "protocol_version": "A6",
        "source": f"{REPO} analysis/human_check (DOI {DOI_VERSION})",
        "text": protocol_text(root),
        "raters": r["raters"],
        "items": items,
        "baseline": r["baseline"],
        "agreement": {a: {"krippendorff_alpha_ordinal": krippendorff_alpha_ordinal(r[a]),
                          "per_metric": results["per_axis"][a]["per_metric"]} for a in AXES},
    }


def build_paper(summ, front, pairs, segs, study, clips):
    q = "analysis/out/motion_confound.json"
    es = sorted(summ)
    rho, p = spearman_exact([summ[e]["motion_median_norm"] for e in es], [summ[e]["drift_median_px"] for e in es])
    g45 = summ["gen4.5"]["motion_median_norm"]
    usable = {k: v for k, v in pairs.items() if v.get("usable")}
    counts = Counter(c.cid.arm for c in clips)
    return {
        "doi_version": _src(DOI_VERSION, "Zenodo record"),
        "doi_concept": _src(DOI_CONCEPT, "Zenodo record"),
        "n_clips": _src(len(clips), "runs/metrics*/ (one JSON per clip)"),
        "n_clips_by_arm": _src(dict(counts), "pipeline ids.parse_clip_id"),
        "league_drift_median_px": _src({e: summ[e]["drift_median_px"] for e in es}, f"{q} q1_motion_by_engine.chamfer_median_px"),
        "motion_median_norm": _src({e: summ[e]["motion_median_norm"] for e in es}, f"{q} q1_motion_by_engine.motion_median_norm"),
        "basis_n": _src({e: summ[e]["n"] for e in es}, f"{q} q1_motion_by_engine.n"),
        "gen45_motion_vs_wan22": _src(g45 / summ["wan22"]["motion_median_norm"], f"{q} ratio of motion medians"),
        "gen45_motion_vs_gen4_turbo": _src(g45 / summ["gen4_turbo"]["motion_median_norm"], f"{q} ratio of motion medians"),
        "engine_rho_motion_drift": _src({"rho": rho, "p_exact_two_sided": p, "n_engines": len(es)},
                                        f"{q} q1_engine_level_rho_motion_vs_chamfer"),
        "pareto": _src(front, f"{q} q5c_pareto"),
        "pairwise_bands": _src({"overlapping": sum(v["overlaps"] for v in pairs.values()),
                                "usable": len(usable),
                                "reversals": sorted(k for k, v in usable.items() if v["reverses_league"]),
                                "min_n": MIN_N}, f"{q} q5a_pairwise_matched_bands"),
        "price_crossovers": _src(segs, "explorer: pipeline lenses.price_crossovers (not in the paper)"),
        "alpha_ordinal": _src({a: study["agreement"][a]["krippendorff_alpha_ordinal"] for a in AXES},
                              "analysis/human_check/human_check_results.json per_axis"),
        "departure_threshold_px": _src(DEPART_PX, "analysis/hazard_rates.py frozen A4 rule (a)"),
        "status_motion": _src("exploratory, post-hoc (pre-registration amendment A6)", "docs/PREREGISTRATION.md"),
    }


def build_fixtures(b, summ, pairs, segs):
    prices = [0.0, 0.5, 1.0, 1.24, 1.25, 1.3, 2.0, 3.0]
    floors = [0.0, 0.001, 0.002, 0.003, 0.004, 0.006, 0.01]
    return {
        "basis": [{"id": c.id, "engine": c.cid.engine, "motion": c.motion_norm, "drift": c.h["line"]} for c in b],
        "summary": summ,
        "pareto": pareto(summ),
        "pairwise": pairs,
        "crossovers": segs,
        "price": {str(p): price_ranking(summ, p) for p in prices},
        "floor": {str(f): floor_ranking(b, f) for f in floors},
        "band": {k: band_ranking(b, v["lo"], v["hi"]) for k, v in pairs.items() if v["overlaps"]},
        "ref_engine": REF_ENGINE, "min_n": MIN_N,
    }


def main(root: Path | None = None, web: Path = WEB) -> Path:
    root = Path(root or release_root())
    out = web / "public" / "data" / CONTRACT
    clips = load_clips(root)
    tags = load_tags()
    b = basis(clips)
    summ = summary(b)
    pairs = pairwise_bands(b, summ)
    segs = price_crossovers(summ)
    study = build_study(root, clips)
    commit = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()

    _write(out / "index.json", {
        "contract": CONTRACT, "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {"doi_version": DOI_VERSION, "doi_concept": DOI_CONCEPT, "repo": REPO, "commit": commit or None},
        "media_base": os.environ.get("MEDIA_BASE", f"https://media.studionephele.com/stilldrawn/{MEDIA_VERSION}/"),
        "counts": dict(Counter(c.cid.arm for c in clips)),
        "missing_cells": [{"cell": "cu-tone-3_idle_gen4t", "reason": "Refused by the engine's moderation (runs/README.md)"}],
    })
    _write(out / "engines.json", build_engines(root))
    _write(out / "panels.json", build_panels(root))
    _write(out / "clips.json", build_clips(clips, tags))
    per_engine = defaultdict(dict)
    for c in clips:
        per_engine[c.cid.engine][c.id] = clip_series(c)
    for e, d in per_engine.items():
        _write(out / "series" / f"{e}.json", d)
    _write(out / "taxonomy.json", tags)
    _write(out / "study" / "stilldrawn.json", study)
    _write(out / "paper.json", build_paper(summ, pareto(summ), pairs, segs, study, clips))
    _write(web / "src" / "lib" / "__fixtures__" / "lenses.json", build_fixtures(b, summ, pairs, segs))
    return out


if __name__ == "__main__":
    print(f"wrote {main()}")
