"""tools/check-stage.mjs refuses a staged masked.json that carries the fixture mark, however its provenance reads."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from stilldrawn_web import masked

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "tools" / "check-stage.mjs"
REAL_LOOKING = {"schema": "stilldrawn-explorer-masked/1", "provenance": {"synthetic": False},
                "masks": {"aaron": {"drawn_by": "A", "rule": "Allowed where the prompt lets the drawing move."},
                          "agent": {"drawn_by": "B", "rule": "Allowed where the prompt lets the drawing move."}}}
needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


def stage(tmp_path, m, index_masked=True):
    d = tmp_path / "stage"
    (d / "public" / "data" / "v1").mkdir(parents=True)
    (d / "public" / "data" / "v1" / "index.json").write_text(json.dumps({"masked": index_masked}))
    if m is not None:
        (d / "public" / "data" / "v1" / "masked.json").write_text(json.dumps(m))
    return d


def check(d):
    r = subprocess.run(["node", str(SCRIPT), str(d), "preview"], capture_output=True, text=True)
    return r.stderr


@needs_node
def test_a_real_looking_masked_json_raises_no_masked_complaint(tmp_path):
    err = check(stage(tmp_path, REAL_LOOKING))
    assert "masked.json" not in err                      # the rest of the folder is incomplete; only masked.json is on trial


@needs_node
def test_the_fixture_mark_in_a_rule_is_refused_even_if_provenance_says_real(tmp_path):
    m = json.loads(json.dumps(REAL_LOOKING))
    m["masks"]["agent"]["rule"] = masked.FIXTURE_MARK + "; not a drawn region."
    assert "fixture mark" in check(stage(tmp_path, m))


@needs_node
def test_the_fixture_mark_in_any_other_field_is_refused(tmp_path):
    m = json.loads(json.dumps(REAL_LOOKING))
    m["status"] = "x " + masked.FIXTURE_MARK
    assert "fixture mark" in check(stage(tmp_path / "other", m))


@needs_node
def test_a_synthetic_provenance_is_still_refused(tmp_path):
    m = json.loads(json.dumps(REAL_LOOKING))
    m["provenance"]["synthetic"] = True
    assert "synthetic" in check(stage(tmp_path, m))
