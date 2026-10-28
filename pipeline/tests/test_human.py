import json

import numpy as np
import pytest

from stilldrawn_web.human import AXES, krippendorff_alpha_ordinal, load_ratings, protocol_text


@pytest.fixture(scope="module")
def ratings(root):
    return load_ratings(root)


def test_six_raters_twenty_clips(ratings, clips):
    assert ratings["raters"] == ["AARON", "R2", "R3", "R4", "R5", "R6"]
    assert len(ratings["cells"]) == 20
    ids = {c.id for c in clips}
    assert set(ratings["cells"]) <= ids
    for a in AXES:
        assert ratings[a].shape == (6, 20)
        assert not np.isnan(ratings[a]).any()
        assert set(np.unique(ratings[a])) <= {1, 2, 3, 4, 5}


def test_alpha_reproduces_results(root, ratings):
    want = json.loads((root / "analysis/human_check/human_check_results.json").read_text())["per_axis"]
    for a in AXES:
        got = krippendorff_alpha_ordinal(ratings[a])
        assert got == pytest.approx(want[a]["krippendorff_alpha_ordinal"], abs=1e-12)
    assert round(krippendorff_alpha_ordinal(ratings["register"]), 3) == 0.209
    assert round(krippendorff_alpha_ordinal(ratings["sameness"]), 3) == 0.478


def test_baseline_panels_named(ratings):
    for rater, panels in ratings["baseline"].items():
        assert len(panels) == 14, rater
        assert all(not p.startswith("p") or "-" in p for p in panels)


def test_protocol_text_verbatim(root):
    t = protocol_text(root)
    assert t["Q2"] == "Apart from the movement itself, is this the same original image throughout?"
    assert t["Q1"].startswith("Does this clip still look like a hand-drawn black-and-white ink")
    for k in ("Q1_LABELS", "Q2_LABELS", "Q3_LABELS"):
        assert len(t[k]) == 5
