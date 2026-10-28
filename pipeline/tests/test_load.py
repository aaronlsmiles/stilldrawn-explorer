import collections
import csv
import math

from stilldrawn_web.headlines import TABLE_COLUMNS
from stilldrawn_web.load import basis


def test_counts_per_arm(clips):
    assert len(clips) == 373
    assert len({c.id for c in clips}) == 373
    arms = collections.Counter(c.cid.arm for c in clips)
    assert arms == {"primary": 164, "flint": 6, "repeat": 98, "ground": 25, "hazard": 71, "seedance": 9}


def test_every_clip_has_file_and_hash(clips):
    for c in clips:
        assert c.mp4.exists(), c.id
        assert len(c.sha256) == 64, c.id
        assert c.bytes > 0


def test_basis_cells_per_engine(clips):
    per = collections.Counter(c.cid.engine for c in basis(clips))
    assert per == {"gen4.5": 33, "h3-fal": 33, "ltx23": 33, "wan22": 33, "gen4_turbo": 32}


def _same(a, b):
    if a is None or b is None:
        return a is None and b is None
    return math.isclose(a, b, rel_tol=1e-12, abs_tol=1e-15)


def test_headlines_match_results_table(root, clips):
    by_id = {c.id: c for c in clips}
    with (root / "analysis" / "out" / "results_table.csv").open() as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == 170
    for r in rows:
        c = by_id[r["cell_id"]]
        for key, col in TABLE_COLUMNS.items():
            want = float(r[col]) if r[col] not in ("", "None") else None
            assert _same(c.h[key], want), (r["cell_id"], key, c.h[key], want)
