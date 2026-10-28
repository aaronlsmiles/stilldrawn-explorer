import json
import re
from collections import defaultdict

import pytest

from stilldrawn_web import export
from stilldrawn_web.export import DEPART_PX, load_tags


def _sections(taxonomy_md: str) -> dict:
    """mode code -> its section text (### X0 · … up to the next heading)."""
    parts = re.split(r"^#{2,3} ", taxonomy_md, flags=re.M)
    out = {}
    for p in parts:
        m = re.match(r"([ABC]\d) · ", p)
        if m:
            out[m.group(1)] = p
    return out


def test_tags_are_transcribed_not_invented(root):
    secs = _sections((root / "docs" / "TAXONOMY.md").read_text())
    tags = load_tags()
    assert set(tags) == {"A1", "A2", "A3", "A4", "B1", "B2", "B3", "C1"}
    assert tags["A4"].get("candidate") is True
    for code, mode in tags.items():
        for cid in mode["clips"]:
            assert f"`{cid}`" in secs[code], (code, cid)


def test_departed_rule_reproduces_hazard_cells(root, clips):
    """Replay hazard_rates.py's per-cell pooling with the per-clip flag."""
    want = json.loads((root / "analysis/out/hazard_rates.json").read_text())
    assert want["threshold_px"] == DEPART_PX
    by_id = {c.id: c for c in clips}
    pooled = defaultdict(list)
    for c in clips:
        if c.cid.arm == "hazard":
            pooled[c.cid.cell].append(c)
    for cell in list(pooled):
        for extra in (cell, f"{cell}-r2"):
            if extra in by_id:
                pooled[cell].append(by_id[extra])
    pooled["cu-line-1_idle_h3"].append(by_id["ground-cu-line-1-v100_idle_h3"])
    for cell, v in want["a4_per_cell"].items():
        draws = [c for c in pooled[cell] if c.h["line"] is not None]
        assert len(draws) == v["n"], cell
        assert sum(c.h["line"] > DEPART_PX for c in draws) == v["departed"], cell


@pytest.fixture(scope="module")
def contract(root, tmp_path_factory):
    web = tmp_path_factory.mktemp("web")
    out = export.main(root, web)
    return out, web


def _load(p):
    return json.loads(p.read_text())


def test_contract_files(contract):
    out, web = contract
    for name in ("index.json", "engines.json", "panels.json", "clips.json", "taxonomy.json", "paper.json",
                 "study/stilldrawn.json"):
        assert (out / name).exists(), name
    assert (web / "src/lib/__fixtures__/lenses.json").exists()
    assert sorted(p.stem for p in (out / "series").glob("*.json")) == sorted(
        ["gen4.5", "gen4_turbo", "h3-fal", "wan22", "ltx23", "seedance"])


def test_clips_contract(contract):
    out, _ = contract
    rows = _load(out / "clips.json")
    assert len(rows) == 373
    assert sum(r["c2pa"] for r in rows) == 288          # Runway 140 + H3 148
    tagged = {r["id"] for r in rows if r["tags"]}
    assert "est-tone-1_burst_gen45" in tagged and "est-tone-1_burst_gen45-r2" not in tagged
    for r in rows:
        assert r["media"]["mp4"] == f"clips/{r['engine']}/{r['id']}.mp4"
        assert set(r["h"]) == {"line", "tone", "edge", "style", "closure"}


def test_panels_and_notice(contract):
    out, _ = contract
    panels = _load(out / "panels.json")
    assert len(panels) == 34
    assert sum(p["notice"] for p in panels) == 14        # 9 Gemini panels + 5 derived ground variants
    assert all(p["alt"] for p in panels)


def test_every_paper_number_has_a_source(contract):
    out, _ = contract
    for k, v in _load(out / "paper.json").items():
        assert set(v) == {"value", "source"} and v["source"], k


def test_study_bundle(contract):
    out, _ = contract
    s = _load(out / "study/stilldrawn.json")
    assert len(s["items"]) == 20 and len(s["raters"]) == 6
    assert round(s["agreement"]["register"]["krippendorff_alpha_ordinal"], 3) == 0.209
    assert all(len(i["ratings"]["sameness"]) == 6 for i in s["items"])


def test_series_files_cover_every_clip(contract):
    out, _ = contract
    n = sum(len(_load(p)) for p in (out / "series").glob("*.json"))
    assert n == 373


def test_engines_name_their_zenodo_zip(contract):
    out, _ = contract
    by = {e["id"]: e for e in _load(out / "engines.json")}
    assert by["gen4.5"]["zip"] == "stilldrawn-clips-gen4.5-v1.0.0.zip"
    assert by["seedance"]["zip"] == "stilldrawn-clips-seedance-v1.0.0.zip"


def test_paper_carries_within_engine_and_pooled_rho(contract, confound):
    out, _ = contract
    paper = _load(out / "paper.json")
    w = paper["within_engine_rho"]
    assert "q2_within_engine_motion_vs_metric" in w["source"]
    want = confound["q2_within_engine_motion_vs_metric"]["gen4.5"]["line_chamfer_mean_px"]
    assert w["value"]["gen4.5"]["line"] == want
    assert w["value"]["gen4.5"]["line"]["n"] == 33
    assert set(w["value"]) == {"gen4.5", "gen4_turbo", "h3-fal", "ltx23", "wan22"}
    assert paper["pooled_rho"]["value"]["line"]["n"] == 164
