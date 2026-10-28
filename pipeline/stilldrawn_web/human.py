"""StillDrawn's human check: the protocol text, the six raters' scores and agreement.

The question wording is read verbatim from the release's build_harness.py by
parsing its literal assignments (the module is not executed).
"""
import ast
import json
from pathlib import Path

import numpy as np

from . import release_root

PROTOCOL_NAMES = ("Q1", "Q1_LABELS", "Q1_MECH", "Q1_TONE", "Q2", "Q2_NOTE", "Q2_CONT",
                  "Q2_LABELS", "Q3", "Q3_LABELS", "WATCH_NOTE")
AXES = ("register", "sameness")


def _hc(root) -> Path:
    return Path(root or release_root()) / "analysis" / "human_check"


def protocol_text(root=None) -> dict:
    tree = ast.parse((_hc(root) / "build_harness.py").read_text())
    out = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name in PROTOCOL_NAMES:
                out[name] = ast.literal_eval(node.value)
    missing = set(PROTOCOL_NAMES) - set(out)
    if missing:
        raise KeyError(f"protocol constants missing from build_harness.py: {sorted(missing)}")
    return out


def load_ratings(root=None) -> dict:
    """-> {raters, cells (in opaque-code order), register/sameness: raters x cells, baseline}."""
    hc = _hc(root)
    mapping = json.loads((hc / "mapping.json").read_text())
    o2c = mapping["opaque_to_cell"]
    bmap = json.loads((hc / "baseline_mapping.json").read_text())
    p2name = bmap["panel_opaque_to_name"]
    codes = sorted(o2c)
    raters, axes, baseline = [], {a: [] for a in AXES}, {}
    for f in sorted((hc / "ratings").glob("ratings-*.json")):
        d = json.loads(f.read_text())
        raters.append(d["rater"])
        for a in AXES:
            got = {r["clip"]: r[a] for r in d["ratings"]}
            axes[a].append([got.get(c, np.nan) for c in codes])
        baseline[d["rater"]] = {p2name[b["panel"]]: b["hand_drawn"] for b in d.get("baseline", [])}
    return {"raters": raters, "cells": [o2c[c] for c in codes],
            **{a: np.asarray(v, dtype=float) for a, v in axes.items()}, "baseline": baseline}


def krippendorff_alpha_ordinal(matrix):
    """raters x items, values 1..5 or nan. Coincidence-matrix α, ordinal distance (port of collect.py)."""
    m = np.asarray(matrix, dtype=float)
    values = sorted({int(v) for v in m[~np.isnan(m)]})
    vi = {v: k for k, v in enumerate(values)}
    V = len(values)
    coin = np.zeros((V, V))
    for item in m.T:
        vals = item[~np.isnan(item)]
        mu = len(vals)
        if mu < 2:
            continue
        idx = [vi[int(v)] for v in vals]
        for i, a in enumerate(idx):
            for j, b in enumerate(idx):
                if i != j:
                    coin[a, b] += 1.0 / (mu - 1)
    n_c = coin.sum(axis=1)
    n_total = n_c.sum()
    if n_total == 0:
        return None

    def delta(c, k):
        lo, hi = min(c, k), max(c, k)
        s = n_c[lo:hi + 1].sum() - (n_c[lo] + n_c[hi]) / 2.0
        return s * s

    Do = sum(coin[c, k] * delta(c, k) for c in range(V) for k in range(V) if c != k)
    De = sum(n_c[c] * n_c[k] * delta(c, k) for c in range(V) for k in range(V) if c != k) / (n_total - 1)
    return None if De == 0 else 1.0 - Do / De
