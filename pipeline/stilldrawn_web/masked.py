"""Re-shape the release's A9 outputs into web/public/data/v1/masked.json.

    uv run python -m stilldrawn_web.masked [--root R] [--web W]
    uv run python -m stilldrawn_web.masked --synthetic-out web/src/views/Tax/__fixtures__

After the results land, use tools/refresh-masked.sh (it checks the release, runs this, then the tests).
A synthetic release (the committed fixtures) is refused unless --allow-fixture, and then only into a scratch --web.

This module computes no statistic. It picks keys, orders rows and renames a few fields;
test_masked.py proves every numeric leaf of the two statistics blocks occurs in the source JSON.
It reads analysis/out/a9_masked_drift.json|.md, a9_adherence.json, a9_eligible.csv,
dataset/masks/allowed-{aaron,agent}.json and runs/metrics-masked/*.json from the release.
"""
import argparse
import csv
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from . import release_root

SCHEMA = "stilldrawn-explorer-masked/1"
STATUS = "exploratory, post-hoc (amendment A9)"
STATES = {"two raters": "two-rater", "author-rated; second rater pending": "pending", "author-rated": "fallback"}
STATE_DIRS = ("pending", "two-rater", "fallback", "fallback-late")     # fixture folders under tests/fixtures/masked/adherence
FALLBACK_READING = "not tested by two raters"
SETS = ("aaron", "agent")
MARGINS = ("m16", "m32", "m64")
ORDER = ("wan22", "gen4_turbo", "ltx23", "gen4.5", "h3-fal")
SUFFIX = {"wan22": "wan22", "gen4_turbo": "gen4t", "ltx23": "ltx23", "gen4.5": "gen45", "h3-fal": "h3"}
DROP = {"g_whole", "g_masked", "delta_g"}          # A9 wording: x only, never "doublings", never log2
OUT = Path("analysis") / "out"
T2, T1 = "a9_masked_drift.json", "a9_adherence.json"
FIXTURE_MARK = "Synthetic shapes for the explorer's fixtures"     # the fixture masks' own `rule`; no real set says this
HERE = Path(__file__).resolve().parent
FIXTURES = HERE.parent / "tests" / "fixtures" / "masked"
WEB = HERE.parent.parent / "web"


def available(root: Path) -> bool:
    """True when both A9 outputs exist; exactly one of the two is a half-published release."""
    root = Path(root)
    have = {n: (root / OUT / n).exists() for n in (T2, T1)}
    if have[T2] != have[T1]:
        missing = T2 if not have[T2] else T1
        raise SystemExit(f"half-published release: {missing} is missing from {root / OUT} (never export one A9 test alone)")
    return have[T2]


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def condition(c: dict) -> dict:
    """A pure key-picker over one grid entry: the source's keys minus DROP, flattened bootstrap."""
    b = c["bootstrap"]
    out = {k: v for k, v in c.items() if k not in DROP | {"mask_set", "margin_px", "bootstrap", "excluded_lt500", "delta_g_ci95"}}
    out["s_ci95"] = b["s_ci95"]
    out["n_excluded"] = len(c["excluded_lt500"])
    out["n_s_finite"] = b["n_s_finite"]
    out["n_g_whole_le_0"] = b["n_g_whole_le_0"]
    return out


def rater(r):
    return r      # pass-through: the page quotes the writer's numbers as they are


def _headlines(md_path: Path) -> dict:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    out = {}
    for s in SETS:
        prefix = f"- {s}'s masks: "
        hit = [x for x in lines if x.startswith(prefix)]
        if not hit:
            raise ValueError(f"{md_path.name}: no headline bullet for the {s} masks (expected a line starting {prefix!r})")
        out[s] = hit[0][len(prefix):]
    return out


def _test2(src: dict, md_path: Path) -> dict:
    conds = {split: {s: {} for s in SETS} for split in src["grid"]}
    for split, items in src["grid"].items():
        for c in items:
            conds[split][c["mask_set"]][f"m{c['margin_px']}"] = condition(c)
    return {"verdict": src["verdict"], "n_eligible_rows": src["n_eligible_rows"],
            "min_f0_line_px_in_R": src["min_f0_line_px_in_R"], "bootstrap": src["bootstrap"],
            "headline_md": _headlines(md_path), "conditions": conds}


def _test1(src: dict) -> dict:
    label = src["label"]
    if label not in STATES:
        raise ValueError(f"a9_adherence.json: unknown label {label!r} (expected one of {sorted(STATES)})")
    state = STATES[label]
    verdict = src["verdict"] if state == "two-rater" else None
    raters = src["raters"]
    return {"state": state, "label": label, "basis": src["basis"], "verdict": verdict,
            "h1_reading": FALLBACK_READING if state == "fallback" else None,
            "steadiness_px": src["steadiness_px"], "attainable_p_no_ties": src["attainable_p_no_ties"],
            "raters": {"AARON": rater(raters.get("AARON")), "R7": rater(raters.get("R7"))},
            # kept whenever R7's files were analysed: the two-rater state, and the fallback when they arrived late
            "kappa": src.get("agreement_quadratic_kappa") if state != "pending" else None,
            "r7_deadline": src["r7_deadline"], "r7_blind_to_engine_styles": src["r7_blind_to_engine_styles"],
            "partial_note": src.get("r7_partial_note")}


def _unscorable(chamfer, flag=False):
    return chamfer is None or bool(flag)


def _clip(rec: dict) -> dict:
    whole = rec["whole_frame"]["chamfer_px"]
    masked = {s: {m: {"px": b["chamfer_px"], "unscorable": _unscorable(b["chamfer_px"], b["no_scorable_frame"]),
                      "f0": b["f0_line_px_in_R"], "region_frac": b["region_frac"]}
                  for m, b in ((m, rec["masked"][s][m]) for m in MARGINS)} for s in SETS}
    return {"clip": rec["cell_id"], "mapping": rec["mapping"], "whole_px": whole,
            "whole_unscorable": whole is None, "masked": masked}


def _rows(root: Path) -> list[dict]:
    masks = {s: json.loads((root / "dataset" / "masks" / f"allowed-{s}.json").read_text(encoding="utf-8")) for s in SETS}
    with open(root / OUT / "a9_eligible.csv", newline="", encoding="utf-8") as f:
        elig = {r["row"]: r for r in csv.DictReader(f)}
    recs = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((root / "runs" / "metrics-masked").glob("*.json"))]
    by_row: dict[str, dict] = {}
    for r in recs:
        by_row.setdefault(f"{r['panel']}_{r['motion']}", {})[r["engine"]] = r
    rows = []
    for key in sorted(elig):
        m = {s: masks[s]["rows"][key] for s in SETS}
        base = m["aaron"]
        clips = {e: _clip(by_row[key][e]) for e in ORDER if e in by_row.get(key, {})}
        rows.append({"row": key, "panel": base["panel"], "motion": base["motion"], "panel_px": base["panel_px"],
                     "eligible": elig[key]["eligible"] == "true", "iou": float(elig[key]["iou"]),
                     "status": {s: m[s]["status"] for s in SETS}, "polygons": {s: m[s]["allowed"] for s in SETS},
                     "clips": clips})
    return rows


def is_fixture(root: Path) -> bool:
    """True when the release's mask files are the committed synthetic ones (marked in their `rule`)."""
    for s in SETS:
        f = Path(root) / "dataset" / "masks" / f"allowed-{s}.json"
        if f.exists() and FIXTURE_MARK in json.loads(f.read_text(encoding="utf-8")).get("rule", ""):
            return True
    return False


def build(root: Path, *, synthetic: bool = False, commit: str | None = None) -> dict | None:
    root = Path(root)
    if not available(root):
        return None
    t2_path, t1_path = root / OUT / T2, root / OUT / T1
    t2 = json.loads(t2_path.read_text(encoding="utf-8"))
    t1 = json.loads(t1_path.read_text(encoding="utf-8"))
    mask_meta = {s: json.loads((root / "dataset" / "masks" / f"allowed-{s}.json").read_text(encoding="utf-8")) for s in SETS}
    return {
        "schema": SCHEMA,
        "provenance": {"synthetic": synthetic, "release_commit": commit,
                       "sources_sha256": {T2: _sha(t2_path), T1: _sha(t1_path)}},
        "status": STATUS,
        "engine_order": t2["engine_order"],
        "test2": _test2(t2, root / OUT / "a9_masked_drift.md"),
        "test1": _test1(t1),
        "masks": {s: {"drawn_by": mask_meta[s]["drawn_by"], "rule": mask_meta[s]["rule"]} for s in SETS},
        "rows": _rows(root),
    }


def summary(m: dict) -> list[str]:
    """Lines for the refresh diff: what the page will say, in the writers' own numbers."""
    t1, t2 = m["test1"], m["test2"]
    lines = [f"test 1: {t1['state']} ({t1['label']}); verdict {t1['verdict']!r}"]
    for name, r in t1["raters"].items():
        p = (r or {}).get("primary")
        lines.append(f"  {name}: " + ("not rated" if not p else f"rho {p['rho']}, one-sided p {p['p_one_sided']}"))
    lines.append(f"test 2: {t2['verdict']}")
    for s in SETS:
        c = t2["conditions"]["all"][s]["m32"]
        lines.append(f"  s ({s}, m32): {c['s']} (95% interval {c['s_ci95']})")
    return lines


def _write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")


def _commit(root: Path) -> str | None:
    out = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return out or None


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", type=Path, default=None, help="the public release (default STILLDRAWN_ROOT)")
    ap.add_argument("--web", type=Path, default=WEB, help="the web folder (default this repo's web/)")
    ap.add_argument("--synthetic-out", type=Path, default=None,
                    help="write masked-<state>.json built from the committed synthetic fixtures, then stop")
    ap.add_argument("--allow-fixture", action="store_true",
                    help="accept a synthetic release, only into a --web other than this repo's (a rehearsal of the refresh)")
    a = ap.parse_args(argv)
    if a.synthetic_out:
        for state in STATE_DIRS:
            with tempfile.TemporaryDirectory() as td:
                root = Path(td) / state
                shutil.copytree(FIXTURES / "release", root)
                shutil.copy(FIXTURES / "adherence" / state / T1, root / OUT)
                _write(a.synthetic_out / f"masked-{state}.json", build(root, synthetic=True))
        print(f"wrote the synthetic states to {a.synthetic_out}")
        return 0
    root = a.root or release_root()
    out = a.web / "public" / "data" / "v1"
    fixture = is_fixture(root)
    if fixture and not a.allow_fixture:
        raise SystemExit(f"{root} is a synthetic fixture release, not a real one: refusing to build masked.json from it")
    if fixture and a.web.resolve() == WEB.resolve():
        raise SystemExit(f"refusing to write {out} from a synthetic release: pass a scratch --web (web/public/data/v1 stays real or absent)")
    m = build(root, synthetic=fixture, commit=None if fixture else _commit(root))
    if m is None:
        (out / "masked.json").unlink(missing_ok=True)
        print("no A9 outputs in the release: masked.json not written")
        return 0
    _write(out / "masked.json", m)
    idx = out / "index.json"
    if idx.exists():
        d = json.loads(idx.read_text(encoding="utf-8"))
        d["masked"] = True
        _write(idx, d)
    print("\n".join(summary(m)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
