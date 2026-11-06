"""Pins the A9 writers' output schema as plain data, so a writer change fails here and not in the view.

The fixtures under tests/fixtures/masked are synthetic (tools/dev/make-masked-fixtures.py):
no clip, rating or masked value in them is real.
"""
import csv
import json
from pathlib import Path

import pytest

FIX = Path(__file__).parent / "fixtures" / "masked"
REL = FIX / "release"
WEB_DATA = Path(__file__).resolve().parents[2] / "web" / "public" / "data" / "v1"

RECORD_KEYS = {"cell_id", "clip", "panel", "motion", "engine", "mapping", "whole_frame", "masked", "m_empty"}
MASKED_KEYS = {"chamfer_px", "no_scorable_frame", "f0_line_px_in_R", "region_frac"}
COND_KEYS = {"mask_set", "margin_px", "n_clips", "D_whole_px", "D_masked_px", "ratio_whole", "ratio_masked", "s",
             "kendall_tau_b", "bootstrap", "n_unscorable_masked", "n_unscorable_whole", "n_m_empty", "excluded_lt500"}
ADH_TOP = {"label", "basis", "verdict", "verdict_status", "engine_order", "steadiness_px", "attainable_p_no_ties",
           "raters", "agreement_quadratic_kappa", "r7_deadline", "r7_blind_to_engine_styles", "r7_declaration",
           "r7_partial_note"}
ELIGIBLE_COLS = ["row", "panel", "motion", "grid", "n_lines", "threshold", "status_aaron", "status_agent", "mask_px_aaron",
                 "mask_px_agent", "n_R_aaron_m32", "n_R_agent_m32", "eligible_aaron", "eligible_agent", "eligible", "iou", "union_px"]
STATES = ("pending", "two-rater", "fallback", "fallback-late")
LABELS = {"pending": "author-rated; second rater pending", "two-rater": "two raters", "fallback": "author-rated", "fallback-late": "author-rated"}


def wanted_rows():
    """The 22 primary idle and burst rows, derived from the committed clips.json."""
    clips = json.loads((WEB_DATA / "clips.json").read_text())
    rows = {}
    for c in clips:
        if c["arm"] == "primary" and c["motion_class"] in ("IDLE", "BURST"):
            m = c["motion_class"].lower()
            rows[f"{c['panel']}_{m}"] = (c["panel"], m)
    return rows, {c["id"] for c in clips if c["arm"] == "primary" and c["motion_class"] in ("IDLE", "BURST")}


@pytest.fixture(scope="module")
def records():
    return [json.loads(p.read_text()) for p in sorted((REL / "runs" / "metrics-masked").glob("*.json"))]


def test_records_have_the_writers_keys(records):
    assert len(records) == 109
    for r in records:
        assert RECORD_KEYS <= set(r), r["cell_id"]
        assert r["mapping"] in ("stretch", "centre-crop")
        assert set(r["masked"]) == {"aaron", "agent"} and set(r["m_empty"]) == {"aaron", "agent"}
        for s in ("aaron", "agent"):
            assert set(r["masked"][s]) == {"m16", "m32", "m64"}
            for k, blk in r["masked"][s].items():
                assert MASKED_KEYS <= set(blk), (r["cell_id"], s, k)
    assert sum(len(r["masked"][s]) for r in records for s in r["masked"]) == 109 * 6


def test_record_ids_are_the_clip_ids_of_the_real_rows(records):
    rows, ids = wanted_rows()
    assert len(rows) == 22
    assert {r["cell_id"] for r in records} == ids and len(ids) == 109
    assert {f"{r['panel']}_{r['motion']}" for r in records} == set(rows)


def test_test2_json_has_the_grid():
    res = json.loads((REL / "analysis" / "out" / "a9_masked_drift.json").read_text())
    assert set(res["grid"]) == {"all", "idle", "burst"}
    for split, conds in res["grid"].items():
        assert len(conds) == 6, split
        for c in conds:
            assert COND_KEYS <= set(c), split
    assert res["verdict"] in ("supported", "mask-dependent", "killed", "not supported", "not testable")
    assert res["engine_order"] == ["wan22", "gen4_turbo", "ltx23", "gen4.5", "h3-fal"]
    md = (REL / "analysis" / "out" / "a9_masked_drift.md").read_text()
    assert "- aaron's masks: Post-hoc (A9): on " in md and "- agent's masks: Post-hoc (A9): on " in md


@pytest.mark.parametrize("state", STATES)
def test_adherence_states_have_the_writers_keys(state):
    res = json.loads((FIX / "adherence" / state / "a9_adherence.json").read_text())
    assert ADH_TOP <= set(res)
    assert res["label"] == LABELS[state]
    assert set(res["raters"]) == {"AARON", "R7"}
    assert not any("overlap" in k for k in res)
    if state == "pending":
        assert res["verdict"] == "no verdict (second rater pending)" and res["raters"]["R7"] is None
        assert res["raters"]["AARON"]["provisional"] == "provisional (AARON only)"
    if state == "fallback":
        assert res["verdict"] == "not tested by two raters" and res["raters"]["R7"] is None
    if state == "fallback-late":      # R7's files came after the deadline: analysed and kept, but no verdict
        assert res["verdict"] == "not tested by two raters" and res["raters"]["R7"] is not None
        assert "after the deadline" in res["basis"] and res["agreement_quadratic_kappa"]
        assert res["verdict_status"] == "no verdict (author-rated fallback)"
    if state == "two-rater":
        assert res["verdict"] in ("supported", "not supported") and res["raters"]["R7"] is not None
        assert res["verdict_status"] == "final"


def test_eligibility_csv_header_and_rows():
    with open(REL / "analysis" / "out" / "a9_eligible.csv", newline="") as f:
        rd = csv.reader(f)
        assert next(rd) == ELIGIBLE_COLS
        rows = [dict(zip(ELIGIBLE_COLS, r)) for r in rd]
    assert set(r["row"] for r in rows) == set(wanted_rows()[0]) and len(rows) == 22
    assert sum(r["eligible"] == "true" for r in rows) == 21


@pytest.mark.parametrize("name", ["aaron", "agent"])
def test_mask_files(name):
    d = json.loads((REL / "dataset" / "masks" / f"allowed-{name}.json").read_text())
    assert d["schema"] == "stilldrawn-allowed-regions/1" and d["set"] == name
    assert set(d["rows"]) == set(wanted_rows()[0])
    for key, r in d["rows"].items():
        assert {"panel", "motion", "panel_px", "allowed", "status"} <= set(r), key
        assert r["status"] in ("drawn", "nothing-allowed")
        assert (r["status"] == "drawn") == bool(r["allowed"]), key
        for poly in r["allowed"]:
            assert len(poly) >= 3
            for x, y in poly:
                assert 0 <= x <= 1 and 0 <= y <= 1
    assert sum(r["status"] == "nothing-allowed" for r in d["rows"].values()) == 4


def test_no_private_commit_ids_or_real_paths():
    for p in FIX.rglob("*"):
        if p.is_file() and p.suffix in (".json", ".md", ".csv", ".txt"):
            t = p.read_text()
            assert "/Users/" not in t and ("ink" + "bench") not in t, p
