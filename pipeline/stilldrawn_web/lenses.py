"""The Stillness Tax lenses, plus the paper's motion-confound statistics.

EXPLORATORY: the motion analysis is post-hoc (pre-registration amendment A6).
The reference statistics are a port of analysis/motion_confound.py and are
tested against its output. The three lenses are the explorer's own ways of
letting a reader set the stability-for-motion exchange rate that the paper
deliberately declines to set.

Basis: primary standard cells; drift = line headline (px); motion = median
normalised optical flow. Percentiles use numpy's default ('linear').
"""
from itertools import permutations
import math

import numpy as np

MIN_N = 5          # the paper's usability rule for a within-band comparison
REF_ENGINE = "wan22"


def _arrays(basis):
    per = {}
    for c in basis:
        e = per.setdefault(c.cid.engine, {"motion": [], "drift": []})
        e["motion"].append(c.motion_norm)
        e["drift"].append(np.nan if c.h["line"] is None else c.h["line"])
    return {e: {k: np.asarray(v, dtype=float) for k, v in d.items()} for e, d in per.items()}


def summary(basis) -> dict:
    """Per engine: n, motion median and IQR, drift median (Q1 of motion_confound.py)."""
    out = {}
    for e, d in sorted(_arrays(basis).items()):
        out[e] = {
            "n": int(d["motion"].size),
            "motion_median_norm": float(np.median(d["motion"])),
            "motion_iqr": [float(np.percentile(d["motion"], 25)), float(np.percentile(d["motion"], 75))],
            "drift_median_px": float(np.nanmedian(d["drift"])),
        }
    return out


def _rank(a):
    order = np.argsort(a, kind="mergesort")
    ranks = np.empty(a.size, dtype=float)
    ranks[order] = np.arange(1, a.size + 1, dtype=float)
    _, inv, counts = np.unique(a, return_inverse=True, return_counts=True)
    for i, c in enumerate(counts):
        if c > 1:
            m = inv == i
            ranks[m] = ranks[m].mean()
    return ranks


def spearman_exact(x, y):
    """Spearman rho with an exact two-sided permutation p (small n only)."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    rx, ry = _rank(x), _rank(y)
    rho = float(np.corrcoef(rx, ry)[0, 1])
    hits = total = 0
    for perm in permutations(ry):
        hits += abs(np.corrcoef(rx, perm)[0, 1]) >= abs(rho) - 1e-12
        total += 1
    return rho, hits / total


def pareto(summ) -> dict:
    """Maximise motion, minimise drift, on engine medians."""
    pts = {e: (v["motion_median_norm"], v["drift_median_px"]) for e, v in summ.items()}
    dominated = {
        e: sorted(o for o, (mo, do) in pts.items()
                  if o != e and mo >= me and do <= de and (mo > me or do < de))
        for e, (me, de) in pts.items()
    }
    return {"frontier": sorted(e for e, d in dominated.items() if not d), "dominated_by": dominated}


def _in_band(d, lo, hi):
    return (d["motion"] >= lo) & (d["motion"] <= hi) & np.isfinite(d["drift"])


def pairwise_bands(basis, summ) -> dict:
    """Each pair compared inside the overlap of their motion IQRs (Q5a)."""
    arr, engines, out = _arrays(basis), sorted(summ), {}
    for i, a in enumerate(engines):
        for b in engines[i + 1:]:
            lo = max(summ[a]["motion_iqr"][0], summ[b]["motion_iqr"][0])
            hi = min(summ[a]["motion_iqr"][1], summ[b]["motion_iqr"][1])
            rec = {"lo": lo, "hi": hi, "overlaps": bool(lo < hi)}
            if rec["overlaps"]:
                for e in (a, b):
                    m = _in_band(arr[e], lo, hi)
                    rec[e] = {"n": int(m.sum()),
                              "drift_median": float(np.median(arr[e]["drift"][m])) if m.sum() else None}
                rec["usable"] = rec[a]["n"] >= MIN_N and rec[b]["n"] >= MIN_N
                if rec["usable"]:
                    rec["winner_in_band"] = a if rec[a]["drift_median"] < rec[b]["drift_median"] else b
                    league_winner = a if summ[a]["drift_median_px"] < summ[b]["drift_median_px"] else b
                    rec["reverses_league"] = rec["winner_in_band"] != league_winner
            out[f"{a}|{b}"] = rec
    return out


def _board(scored: dict, unranked: dict) -> list[dict]:
    rows = [{"engine": e, **v, "ranked": True} for e, v in sorted(scored.items(), key=lambda kv: (kv[1]["score"], kv[0]))]
    rows += [{"engine": e, **v, "ranked": False} for e, v in sorted(unranked.items())]
    for i, r in enumerate(rows):
        r["rank"] = i + 1 if r["ranked"] else None
    return rows


def price_ranking(summ, p: float, ref: str = REF_ENGINE) -> list[dict]:
    """score = drift median − p · log2(motion median / reference motion median).

    p is the pixels of line drift a reader would accept for a doubling of motion.
    p = 0 is the paper's stability league.
    """
    m_ref = summ[ref]["motion_median_norm"]
    scored = {}
    for e, v in summ.items():
        doublings = math.log2(v["motion_median_norm"] / m_ref)
        scored[e] = {"score": v["drift_median_px"] - p * doublings, "doublings": doublings,
                     "drift_median_px": v["drift_median_px"], "n": v["n"]}
    return _board(scored, {})


def price_crossovers(summ, p_max: float = 3.0, ref: str = REF_ENGINE) -> list[dict]:
    """The leader as a piecewise function of p on [0, p_max]."""
    m_ref = summ[ref]["motion_median_norm"]
    lines = {e: (v["drift_median_px"], math.log2(v["motion_median_norm"] / m_ref)) for e, v in summ.items()}
    cuts = {0.0, p_max}
    es = sorted(lines)
    for i, a in enumerate(es):
        for b in es[i + 1:]:
            (da, xa), (db, xb) = lines[a], lines[b]
            if xa != xb:
                p = (da - db) / (xa - xb)
                if 0 < p < p_max:
                    cuts.add(p)
    cuts = sorted(cuts)
    segments = []
    for lo, hi in zip(cuts, cuts[1:]):
        mid = (lo + hi) / 2
        leader = min(es, key=lambda e: (lines[e][0] - mid * lines[e][1], e))
        if segments and segments[-1]["leader"] == leader:
            segments[-1]["p_to"] = hi
        else:
            segments.append({"p_from": lo, "p_to": hi, "leader": leader})
    return segments


def _subset_board(basis, keep) -> list[dict]:
    scored, unranked = {}, {}
    for e, d in sorted(_arrays(basis).items()):
        m = keep(d)
        n = int(m.sum())
        rec = {"n": n, "drift_median_px": float(np.median(d["drift"][m])) if n else None}
        if n >= MIN_N:
            scored[e] = {**rec, "score": rec["drift_median_px"]}
        else:
            unranked[e] = {**rec, "score": None, "reason": f"too few clips (n = {n})"}
    return _board(scored, unranked)


def floor_ranking(basis, f: float) -> list[dict]:
    """Only clips that move at least f count."""
    return _subset_board(basis, lambda d: (d["motion"] >= f) & np.isfinite(d["drift"]))


def band_ranking(basis, lo: float, hi: float) -> list[dict]:
    """Only clips whose motion lies in [lo, hi] count."""
    return _subset_board(basis, lambda d: _in_band(d, lo, hi))
