"""Every figure a film caption may quote, read from the data contract (never typed by hand).

    python3 film/build/facts.py        writes film/build/out/facts.json
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "web/public/data/v1"
STUDY = ROOT / "web/public/data/blindpanel/stilldrawn"
OUT = Path(__file__).resolve().parent / "out"

# The clips the films show by name (spec, P01 beats 1 and 3)
HOOK = {"g45": "act-tone-2_campush_gen45", "wan": "act-tone-2_campush_wan22"}
PICK = "est-line-1_idle_gen45"

# Text with digits that is not a figure: licence, year of the data's attribution, the rating scale
ALLOWED = ["CC BY 4.0", "2026", "1–5"]


def _load(p):
    return json.loads(Path(p).read_text())


def px(v):
    return f"{v:.2f}"


def build():
    paper = {k: v["value"] for k, v in _load(DATA / "paper.json").items()}
    clips = {c["id"]: c for c in _load(DATA / "clips.json")}
    study = _load(STUDY / "study.json")
    reveal = _load(STUDY / "reveal.json")
    cross = paper["price_crossovers"]
    lead_from = {c["leader"]: c["p_from"] for c in cross}
    er = paper["engine_rho_motion_drift"]
    return {
        "hook_g45_line": px(clips[HOOK["g45"]]["h"]["line"]),
        "hook_wan_line": px(clips[HOOK["wan"]]["h"]["line"]),
        "hook_g45_flow": px(clips[HOOK["g45"]]["motion"]["median_px"]),
        "hook_wan_flow": px(clips[HOOK["wan"]]["motion"]["median_px"]),
        "pick_line": px(clips[PICK]["h"]["line"]),
        "rho": f"{er['rho']:.2f}",
        "p_exact": f"{er['p_exact_two_sided']:.3f}",
        "n_engines": str(er["n_engines"]),
        "x_ltx": px(lead_from["ltx23"]),
        "x_g45": px(lead_from["gen4.5"]),
        "price_max": px(cross[-1]["p_to"]),
        "alpha_register": f"{paper['alpha_ordinal']['register']:.2f}",
        "alpha_sameness": f"{paper['alpha_ordinal']['sameness']:.2f}",
        "n_raters": str(len(reveal["reference"]["raters"])),
        "n_study_clips": str(len(study["parts"]["clips"]["items"])),
        "session_size": str(study["parts"]["clips"]["session_size"]),
        "n_clips_total": str(paper["n_clips"]),
        "doi": paper["doi_version"],
    }


def _names():
    engines = [e["name"] for e in _load(DATA / "engines.json")]
    panels = [p["id"] for p in _load(DATA / "panels.json")]
    return sorted(engines + panels + ALLOWED, key=len, reverse=True)


def check_caption(text, facts):
    """Raise ValueError if `text` carries a figure that isn't one of `facts`' values."""
    rest = text
    for v in sorted(facts.values(), key=len, reverse=True):
        if not re.fullmatch(r"[\d.]+", v):
            rest = rest.replace(v, " ")
    for n in _names():
        rest = rest.replace(n, " ")
    rest = re.sub(r"×\d+", " ", rest)  # speed badges
    allowed = set(facts.values())
    bad = [t for t in re.findall(r"\d+(?:\.\d+)?", rest) if t not in allowed]
    if bad:
        raise ValueError(f"figures not in the data contract: {bad} in {text!r}")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    (OUT / "facts.json").write_text(json.dumps(build(), indent=1) + "\n")
    print(json.dumps(build(), indent=1))
