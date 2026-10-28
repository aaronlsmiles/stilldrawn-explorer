import math

import pytest

from stilldrawn_web.lenses import (band_ranking, floor_ranking, pairwise_bands, pareto,
                                   price_crossovers, price_ranking, spearman_exact, summary)
from stilldrawn_web.load import basis

LEAGUE = ["wan22", "gen4_turbo", "ltx23", "gen4.5", "h3-fal"]


@pytest.fixture(scope="module")
def b(clips):
    return basis(clips)


@pytest.fixture(scope="module")
def summ(b):
    return summary(b)


def test_summary_matches_paper(summ, confound):
    q1 = confound["q1_motion_by_engine"]
    assert set(summ) == set(q1)
    for e, v in summ.items():
        assert v["n"] == q1[e]["n"]
        assert v["motion_median_norm"] == pytest.approx(q1[e]["motion_median_norm"], rel=1e-12)
        assert v["motion_iqr"] == pytest.approx(q1[e]["motion_iqr"], rel=1e-12)
        assert v["drift_median_px"] == pytest.approx(q1[e]["chamfer_median_px"], rel=1e-12)


def test_rounded_paper_values(summ):
    assert [round(summ[e]["drift_median_px"], 2) for e in LEAGUE] == [0.78, 2.64, 2.80, 4.79, 5.38]
    ratio = summ["gen4.5"]["motion_median_norm"]
    assert round(ratio / summ["wan22"]["motion_median_norm"], 1) == 9.2
    assert round(ratio / summ["gen4_turbo"]["motion_median_norm"], 1) == 3.8


def test_engine_level_spearman(summ, confound):
    es = sorted(summ)
    rho, p = spearman_exact([summ[e]["motion_median_norm"] for e in es], [summ[e]["drift_median_px"] for e in es])
    want = confound["q1_engine_level_rho_motion_vs_chamfer"]
    assert rho == pytest.approx(want["rho"]) and p == pytest.approx(want["p"])
    assert round(rho, 2) == 0.9 and round(p, 3) == 0.083


def test_pareto(summ, confound):
    got = pareto(summ)
    assert got["frontier"] == sorted(confound["q5c_pareto"]["frontier"])
    assert got["dominated_by"]["h3-fal"] == ["gen4.5"]


def test_pairwise_bands(b, summ, confound):
    got, want = pairwise_bands(b, summ), confound["q5a_pairwise_matched_bands"]
    assert sum(r["overlaps"] for r in got.values()) == 8
    assert sum(bool(r.get("usable")) for r in got.values()) == 5
    assert sum(bool(r.get("reverses_league")) for r in got.values()) == 2
    for k, w in want.items():
        g = got[k]
        assert g["overlaps"] == w["overlaps"]
        if w["overlaps"]:
            assert g["usable"] == w["usable"]
            assert g.get("winner_in_band") == w.get("winner_in_band")
            for e in k.split("|"):
                assert g[e]["n"] == w[e]["n"]
                assert g[e]["drift_median"] == pytest.approx(w[e]["drift_median"])
    reversed_pairs = {k for k, r in got.items() if r.get("reverses_league")}
    assert reversed_pairs == {"gen4_turbo|h3-fal", "gen4_turbo|ltx23"}


def test_price_zero_is_the_league(summ):
    assert [r["engine"] for r in price_ranking(summ, 0.0)] == LEAGUE


def test_price_crossovers(summ):
    segs = price_crossovers(summ)
    assert segs[0]["leader"] == "wan22" and segs[0]["p_from"] == 0.0
    assert segs[-1]["leader"] == "gen4.5" and segs[-1]["p_to"] == 3.0
    front = set(pareto(summ)["frontier"])
    assert {s["leader"] for s in segs} <= front          # only front engines can lead
    for s in segs:                                          # leader really is #1 inside its segment
        mid = (s["p_from"] + s["p_to"]) / 2
        assert price_ranking(summ, mid)[0]["engine"] == s["leader"]


def test_floor_zero_is_the_league(b):
    rows = floor_ranking(b, 0.0)
    assert [r["engine"] for r in rows] == LEAGUE and all(r["ranked"] for r in rows)


def test_floor_marks_small_n_unranked(b):
    rows = floor_ranking(b, 0.004)
    small = [r for r in rows if r["n"] < 5]
    assert small and all(not r["ranked"] and r["rank"] is None for r in small)
    assert all(r["ranked"] for r in rows if r["n"] >= 5)


def test_band_presets_reproduce_pairs(b, summ):
    for k, rec in pairwise_bands(b, summ).items():
        if not rec.get("usable"):
            continue
        a, c = k.split("|")
        rows = {r["engine"]: r for r in band_ranking(b, rec["lo"], rec["hi"])}
        assert rows[a]["n"] == rec[a]["n"] and rows[c]["n"] == rec[c]["n"]
        winner = a if rows[a]["drift_median_px"] < rows[c]["drift_median_px"] else c
        assert winner == rec["winner_in_band"]
