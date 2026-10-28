import pytest

from stilldrawn_web.series import clip_series, round_sig


def test_round_sig():
    assert round_sig(0.000123456) == 0.0001235
    assert round_sig(123.456) == 123.5
    assert round_sig(0.0) == 0.0
    assert round_sig(None) is None
    assert round_sig(float("nan")) is None


def test_lengths_follow_frame_count(clips):
    n_tone_null = 0
    for c in clips:
        s = clip_series(c)
        n = c.n_frames
        assert len(s["line"]) == len(s["iou"]) == len(s["style"]) == n - 1, c.id
        assert len(s["edge"]) == len(s["closure"]) == n, c.id
        assert len(s["motion"]) == (n - 1) // 2, c.id
        if s["tone"] is None:
            n_tone_null += 1
        else:
            assert len(s["tone"]) == n
    assert n_tone_null == 54


def test_rounded_series_stay_close(clips):
    c = clips[0]
    import json
    raw = json.loads(c.metrics_path.read_text())["metrics"]["line_drift"]["vs_frame0"]["chamfer_series"]
    got = clip_series(c)["line"]
    assert got == pytest.approx(raw, rel=5e-4, abs=1e-12)
