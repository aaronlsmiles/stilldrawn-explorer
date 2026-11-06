#!/usr/bin/env python3
"""Generate the synthetic A9 fixtures under pipeline/tests/fixtures/masked.

synthetic, no clip, rating or masked value is real; regenerate only with the writers re-read.

    python3 tools/dev/make-masked-fixtures.py --source <checkout holding analysis/ and metrics/>

The fixtures come from the registered scripts' own synthetic test helpers (Test 2:
test_a9_masked_drift.fixture + a9_masked_drift.run; Test 1: test_a9_adherence.fixture +
a9_adherence.run). Nothing is read from a clip, a rating or a real masked value, and
nothing is written inside --source. CI never runs this; it needs the private checkout.
"""
import argparse
import csv
import hashlib
import importlib
import json
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True          # never leave a __pycache__ in the source checkout

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = REPO / "pipeline" / "tests" / "fixtures" / "masked"
CLIPS = REPO / "web" / "public" / "data" / "v1" / "clips.json"
MAPPING = {"h3-fal": "stretch"}          # every other engine: centre-crop
NOTHING = {"aaron": ["chain-est-cosmic-1_burst", "chain-est-cosmic-1_idle", "est-black-3_burst", "est-line-1_idle"],
           "agent": ["chain-est-cosmic-1_burst", "chain-est-cosmic-1_idle", "est-line-2_burst", "est-tone-1_burst"]}
INELIGIBLE = "cu-line-2_burst"          # both sets cover the whole panel: nothing left to measure
GRID = 200                              # raster for the synthetic areas and IoU
MARK = "SYNTHETIC TEST FIXTURE: not a result (see PROVENANCE.txt)"   # first line of every generated .md


def mark_json(path):
    """Add the top-level synthetic flag to a generated JSON (the consumers read named keys only)."""
    d = json.loads(path.read_text())
    path.write_text(json.dumps({"synthetic": True, **d}, indent=1) + "\n")


def mark_md(path):
    path.write_text(MARK + "\n\n" + path.read_text())


def seeded(key):
    return np.random.default_rng(int(hashlib.sha256(key.encode()).hexdigest()[:12], 16))


def shape(row, name):
    """A rectangle (aaron) or an ellipse (agent), seeded by the row id; fractions of the panel."""
    r = seeded(f"{name}:{row}")
    cx, cy = 0.25 + 0.5 * r.random(), 0.25 + 0.5 * r.random()
    rx, ry = 0.08 + 0.18 * r.random(), 0.08 + 0.18 * r.random()
    return ("rect" if name == "aaron" else "ellipse", cx, cy, rx, ry)


def polygon(spec):
    kind, cx, cy, rx, ry = spec
    if kind == "rect":
        pts = [(cx - rx, cy - ry), (cx + rx, cy - ry), (cx + rx, cy + ry), (cx - rx, cy + ry)]
    else:
        pts = [(cx + rx * np.cos(t), cy + ry * np.sin(t)) for t in np.linspace(0, 2 * np.pi, 24, endpoint=False)]
    return [[round(float(min(1.0, max(0.0, x))), 5), round(float(min(1.0, max(0.0, y))), 5)] for x, y in pts]


def raster(spec):
    if spec == "full":
        return np.ones((GRID, GRID), bool)
    if spec is None:
        return np.zeros((GRID, GRID), bool)
    kind, cx, cy, rx, ry = spec
    ys, xs = (np.mgrid[0:GRID, 0:GRID] + 0.5) / GRID
    if kind == "rect":
        return (abs(xs - cx) <= rx) & (abs(ys - cy) <= ry)
    return ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2 <= 1


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="a checkout holding analysis/ and metrics/ (read only)")
    ap.add_argument("--date", default=None, help="date for PROVENANCE.txt (default today)")
    a = ap.parse_args(argv)
    src = Path(a.source).resolve()
    sys.path.insert(0, str(src / "analysis"))
    t2 = importlib.import_module("test_a9_masked_drift")
    md = importlib.import_module("a9_masked_drift")
    t1 = importlib.import_module("test_a9_adherence")
    ad = importlib.import_module("a9_adherence")

    clips = [c for c in json.loads(CLIPS.read_text()) if c["arm"] == "primary" and c["motion_class"] in ("IDLE", "BURST")]
    rows = sorted({(c["panel"], c["motion_class"].lower()) for c in clips}, key=lambda t: f"{t[0]}_{t[1]}")
    assert len(rows) == 22 and len(clips) == 109, (len(rows), len(clips))
    keys = [f"{p}_{m}" for p, m in rows]
    by_id = {c["id"]: c for c in clips}
    panel_px = {}
    for c in clips:
        wh = (c["width"], c["height"])
        if c["panel"] not in panel_px or wh[0] * wh[1] > panel_px[c["panel"]][0] * panel_px[c["panel"]][1]:
            panel_px[c["panel"]] = wh

    # ------------------------------------------------------------ masks and eligibility
    specs = {s: {} for s in ("aaron", "agent")}
    for s in specs:
        for k in keys:
            specs[s][k] = None if k in NOTHING[s] else ("full" if k == INELIGIBLE else shape(k, s))
    out = OUT
    if out.exists():
        shutil.rmtree(out)
    (out / "release" / "dataset" / "masks").mkdir(parents=True)
    for s, who in (("aaron", "AARON"), ("agent", "synthetic-agent")):
        doc = {"schema": "stilldrawn-allowed-regions/1", "set": s, "drawn_by": who,
               "rule": "Synthetic shapes for the explorer's fixtures; not a drawn region.", "notes": "", "rows": {}}
        for (p, m), k in zip(rows, keys):
            sp = specs[s][k]
            allowed = [] if sp is None else ([[[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]] if sp == "full" else [polygon(sp)])
            doc["rows"][k] = {"panel": p, "motion": m, "panel_px": list(panel_px[p]), "allowed": allowed,
                              "status": "drawn" if allowed else "nothing-allowed"}
        (out / "release" / "dataset" / "masks" / f"allowed-{s}.json").write_text(json.dumps(doc, indent=1) + "\n")

    header = next(csv.reader(open(src / "analysis" / "out" / "a9_eligible.csv", newline="")))
    elig, table = set(), []
    for (p, m), k in zip(rows, keys):
        w, h = panel_px[p]
        n_lines = int(seeded("lines:" + k).integers(60000, 200000))
        thr = round(n_lines * 0.1, 1)
        ra, rg = raster(specs["aaron"][k]), raster(specs["agent"][k])
        px = {"aaron": round(ra.mean() * w * h), "agent": round(rg.mean() * w * h)}
        union = round((ra | rg).mean() * w * h)
        iou = 1.0 if union == 0 else round(float((ra & rg).sum() / (ra | rg).sum()), 4)
        nr = {s: round(n_lines * (1 - (raster(specs[s][k]).mean() * 0.9))) for s in px}
        ok = {s: nr[s] >= thr for s in px}
        if ok["aaron"] and ok["agent"]:
            elig.add(k)
        table.append([k, p, m, f"{w}x{h}", n_lines, thr,
                      "nothing-allowed" if specs["aaron"][k] is None else "drawn",
                      "nothing-allowed" if specs["agent"][k] is None else "drawn",
                      px["aaron"], px["agent"], nr["aaron"], nr["agent"],
                      str(ok["aaron"]).lower(), str(ok["agent"]).lower(), str(ok["aaron"] and ok["agent"]).lower(),
                      f"{iou:.4f}", union])
    assert len(elig) == 21 and INELIGIBLE not in elig

    # ------------------------------------------------------------ Test 2 (the writers' own helpers)
    with tempfile.TemporaryDirectory() as td:
        root = Path(td) / "t2"
        t2.ROWS = rows
        t2.fixture(root, masked_ratio={"aaron": 2.0, "agent": 2.2}, eligible=elig)
        res = md.run(root)
        rel = out / "release"
        (rel / "analysis" / "out").mkdir(parents=True)
        for ext in ("json", "md"):
            shutil.copy(root / "analysis" / "out" / f"a9_masked_drift.{ext}", rel / "analysis" / "out")
        (rel / "runs" / "metrics-masked").mkdir(parents=True)
        for f in sorted((root / "runs" / "metrics-masked").glob("*.json")):
            rec = json.loads(f.read_text())
            c = by_id[rec["cell_id"]]
            rec["clip"] = c["media"]["mp4"]
            rec["mapping"] = MAPPING.get(rec["engine"], "centre-crop")
            (rel / "runs" / "metrics-masked" / f.name).write_text(json.dumps(rec, indent=1) + "\n")
    with open(out / "release" / "analysis" / "out" / "a9_eligible.csv", "w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(table)

    # ------------------------------------------------------------ Test 1: the four states
    for state, kw in (("pending", {}), ("two-rater", {"r7": t1.SUPPORTED}), ("fallback", {"deadline_passed": True}),
                      ("fallback-late", {"r7": t1.SUPPORTED, "r7_on": "2026-11-20"})):      # R7's files arrive after the deadline
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / state
            t1.fixture(root, aaron=t1.SUPPORTED, **kw)
            ad.run(root)
            d = out / "adherence" / state
            d.mkdir(parents=True)
            shutil.copy(root / "analysis" / "out" / "a9_adherence.json", d)

    for f in sorted(out.rglob("*.json")):
        mark_json(f)
    for f in sorted(out.rglob("*.md")):
        mark_md(f)

    day = a.date or __import__("datetime").date.today().isoformat()
    (out / "PROVENANCE.txt").write_text(
        f"Generated by tools/dev/make-masked-fixtures.py on {day} with the registered A9 scripts' own\n"
        "synthetic test helpers (Test 2 and Test 1). No clip, rating, mask or masked value in this folder is real.\n"
        "Release layout: release/ (Test 2 inputs, masks, eligibility), adherence/<state>/a9_adherence.json.\n")
    print("wrote", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
