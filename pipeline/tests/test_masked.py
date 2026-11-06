"""masked.py only re-shapes the release's A9 outputs; these tests prove it computes nothing."""
import json
import math
import shutil
from pathlib import Path

import pytest

from stilldrawn_web import masked

FIX = Path(__file__).parent / "fixtures" / "masked"
WEB_FIXTURES = Path(__file__).resolve().parents[2] / "web" / "src" / "views" / "Tax" / "__fixtures__"
STATES = ("pending", "two-rater", "fallback", "fallback-late")
ORDER = ["wan22", "gen4_turbo", "ltx23", "gen4.5", "h3-fal"]


def make_root(tmp_path, state="pending", masked_json=True, adherence=True) -> Path:
    root = tmp_path / state
    shutil.copytree(FIX / "release", root)
    if not masked_json:
        (root / "analysis" / "out" / "a9_masked_drift.json").unlink()
    if adherence:
        shutil.copy(FIX / "adherence" / state / "a9_adherence.json", root / "analysis" / "out")
    return root


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    out = {}
    for s in STATES:
        out[s] = masked.build(make_root(tmp_path_factory.mktemp(s), s), synthetic=True)
    return out


def numeric_leaves(x):
    if isinstance(x, bool):
        return
    if isinstance(x, (int, float)):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from numeric_leaves(v)
    elif isinstance(x, list):
        for v in x:
            yield from numeric_leaves(v)


def keys_anywhere(x):
    if isinstance(x, dict):
        for k, v in x.items():
            yield k
            yield from keys_anywhere(v)
    elif isinstance(x, list):
        for v in x:
            yield from keys_anywhere(v)


def test_available_needs_both_files(tmp_path):
    assert masked.available(make_root(tmp_path / "a")) is True
    nothing = tmp_path / "none"
    nothing.mkdir()
    assert masked.available(nothing) is False
    assert masked.build(nothing) is None


@pytest.mark.parametrize("missing", ["a9_masked_drift.json", "a9_adherence.json"])
def test_half_published_release_is_refused(tmp_path, missing):
    root = make_root(tmp_path)
    (root / "analysis" / "out" / missing).unlink()
    with pytest.raises(SystemExit) as e:
        masked.available(root)
    assert missing in str(e.value)
    with pytest.raises(SystemExit):
        masked.build(root)


def test_rows(built):
    m = built["pending"]
    rows = m["rows"]
    assert len(rows) == 22 and [r["row"] for r in rows] == sorted(r["row"] for r in rows)
    masks = {s: json.loads((FIX / "release" / "dataset" / "masks" / f"allowed-{s}.json").read_text())["rows"]
             for s in ("aaron", "agent")}
    for r in rows:
        want = 4 if r["row"] == "cu-tone-3_idle" else 5
        assert len(r["clips"]) == want, r["row"]
        assert ("gen4_turbo" in r["clips"]) == (r["row"] != "cu-tone-3_idle")
        assert list(r["clips"]) == [e for e in ORDER if e in r["clips"]]
        for s in ("aaron", "agent"):
            assert r["polygons"][s] == masks[s][r["row"]]["allowed"]
            assert r["status"][s] == masks[s][r["row"]]["status"]
        assert isinstance(r["eligible"], bool) and isinstance(r["iou"], float)
    assert sum(r["eligible"] for r in rows) == 21
    c = rows[0]["clips"]["wan22"]
    assert c["clip"] == f"{rows[0]['row']}_wan22" and c["mapping"] in ("stretch", "centre-crop")
    assert set(c["masked"]["aaron"]) == {"m16", "m32", "m64"}
    assert set(c["masked"]["aaron"]["m32"]) == {"px", "unscorable", "f0", "region_frac"}


def test_conditions(built):
    t2 = built["pending"]["test2"]
    assert set(t2["conditions"]) == {"all", "idle", "burst"}
    for split in t2["conditions"].values():
        assert set(split) == {"aaron", "agent"}
        for s in split.values():
            assert set(s) == {"m16", "m32", "m64"}
    for m in built.values():
        assert not ({"g_whole", "g_masked", "delta_g", "delta_g_ci95", "n_delta_g_finite"} & set(keys_anywhere(m)))
    cond = t2["conditions"]["all"]["aaron"]["m32"]
    assert {"s_ci95", "n_excluded", "n_s_finite", "n_g_whole_le_0", "ratio_masked"} <= set(cond)
    assert "excluded_lt500" not in cond and "bootstrap" not in cond


def test_no_computation(built, tmp_path):
    root = make_root(tmp_path)
    src2 = json.loads((root / "analysis" / "out" / "a9_masked_drift.json").read_text())
    for state, m in built.items():
        src1 = json.loads((FIX / "adherence" / state / "a9_adherence.json").read_text())
        pool = list(numeric_leaves(src1)) + list(numeric_leaves(src2))
        for block, name in ((m["test1"], "test1"), (m["test2"], "test2")):
            for v in numeric_leaves({k: x for k, x in block.items() if k != "headline_md"}):
                assert any(math.isclose(v, p, rel_tol=1e-12, abs_tol=0) for p in pool), (state, name, v)


def test_n_excluded_is_the_list_length(built):
    src = json.loads((FIX / "release" / "analysis" / "out" / "a9_masked_drift.json").read_text())
    want = {(c["mask_set"], c["margin_px"]): len(c["excluded_lt500"]) for c in src["grid"]["all"]}
    for (s, k), n in want.items():
        assert built["pending"]["test2"]["conditions"]["all"][s][f"m{k}"]["n_excluded"] == n


def test_state_mapping(built):
    p, t, f = built["pending"]["test1"], built["two-rater"]["test1"], built["fallback"]["test1"]
    assert (p["state"], t["state"], f["state"]) == ("pending", "two-rater", "fallback")
    assert p["label"] == "author-rated; second rater pending" and p["verdict"] is None
    assert p["raters"]["R7"] is None and p["raters"]["AARON"]["provisional"] == "provisional (AARON only)"
    assert "provisional_word" not in p and p["h1_reading"] is None
    assert t["label"] == "two raters" and t["verdict"] in ("supported", "not supported") and t["raters"]["R7"]
    assert f["verdict"] is None and f["h1_reading"] == "not tested by two raters" and f["raters"]["R7"] is None
    for x in (p, t, f):
        assert x["r7_blind_to_engine_styles"] is True and x["r7_deadline"]
    # the pending state carries no verdict word anywhere in the test 1 block
    assert "supported" not in json.dumps(p["verdict"]) and p["verdict"] is None


def test_late_r7_fallback_keeps_r7_and_kappa(built):
    """R7's files arrived after the deadline: the writer keeps raters.R7 and kappa, labelled author-rated, no verdict."""
    f, plain = built["fallback-late"]["test1"], built["fallback"]["test1"]
    assert f["state"] == "fallback" and f["label"] == "author-rated" and f["verdict"] is None
    assert f["h1_reading"] == "not tested by two raters"
    assert f["raters"]["R7"] is not None and f["raters"]["R7"]["primary"]["per_engine"]
    assert f["kappa"] and set(f["kappa"]) == {"burst", "push"}
    src = json.loads((FIX / "adherence" / "fallback-late" / "a9_adherence.json").read_text())
    assert f["kappa"] == src["agreement_quadratic_kappa"]
    assert plain["kappa"] is None and plain["raters"]["R7"] is None          # the plain fallback has neither
    assert built["pending"]["test1"]["kappa"] is None                         # pending never gets one


def test_unknown_label_is_refused(tmp_path):
    root = make_root(tmp_path)
    f = root / "analysis" / "out" / "a9_adherence.json"
    d = json.loads(f.read_text())
    d["label"] = "somebody else"
    f.write_text(json.dumps(d))
    with pytest.raises(ValueError, match="somebody else"):
        masked.build(root)


def test_headline_is_the_md_bullet(built, tmp_path):
    md = (FIX / "release" / "analysis" / "out" / "a9_masked_drift.md").read_text().splitlines()
    for s in ("aaron", "agent"):
        line = next(x for x in md if x.startswith(f"- {s}'s masks: "))
        assert built["pending"]["test2"]["headline_md"][s] == line[len(f"- {s}'s masks: "):]
    root = make_root(tmp_path)
    f = root / "analysis" / "out" / "a9_masked_drift.md"
    f.write_text("\n".join(x for x in f.read_text().splitlines() if not x.startswith("- agent's masks: ")))
    with pytest.raises(ValueError, match="agent"):
        masked.build(root)


def test_null_chamfer_is_infinity_not_missing(tmp_path):
    root = make_root(tmp_path)
    f = root / "runs" / "metrics-masked" / "act-black-2_idle_wan22.json"
    d = json.loads(f.read_text())
    d["masked"]["aaron"]["m32"].update(chamfer_px=None, no_scorable_frame=True)
    d["whole_frame"]["chamfer_px"] = None
    f.write_text(json.dumps(d))
    row = next(r for r in masked.build(root)["rows"] if r["row"] == "act-black-2_idle")
    c = row["clips"]["wan22"]
    assert c["masked"]["aaron"]["m32"]["px"] is None and c["masked"]["aaron"]["m32"]["unscorable"] is True
    assert c["whole_px"] is None and c["whole_unscorable"] is True
    assert c["masked"]["aaron"]["m16"]["unscorable"] is False


def test_provenance_and_determinism(tmp_path):
    root = make_root(tmp_path)
    a, b = masked.build(root), masked.build(root)
    assert a["provenance"]["synthetic"] is False and a["provenance"]["release_commit"] is None
    assert set(a["provenance"]["sources_sha256"]) == {"a9_masked_drift.json", "a9_adherence.json"}
    assert json.dumps(a) == json.dumps(b)
    assert masked.build(root, synthetic=True, commit="abc")["provenance"] == {
        **a["provenance"], "synthetic": True, "release_commit": "abc"}
    assert a["schema"] == "stilldrawn-explorer-masked/1" and a["engine_order"] == ORDER


def test_size_guard(built):
    for m in built.values():
        assert len(json.dumps(m, separators=(",", ":"))) < 600_000


def test_summary_lines(built):
    lines = masked.summary(built["pending"])
    text = "\n".join(lines)
    assert "pending" in text and "rho" in text and "s (aaron, m32)" in text and built["pending"]["test2"]["verdict"] in text


def test_web_fixtures_cannot_drift(tmp_path):
    for s in STATES:
        want = masked.build(make_root(tmp_path / s, s), synthetic=True)
        got = json.loads((WEB_FIXTURES / f"masked-{s}.json").read_text())
        assert got == want, s
        assert got["provenance"]["synthetic"] is True


def test_synthetic_out_writes_every_state(tmp_path):
    assert masked.main(["--synthetic-out", str(tmp_path)]) == 0
    for s in STATES:
        want = "fallback" if s == "fallback-late" else s
        assert json.loads((tmp_path / f"masked-{s}.json").read_text())["test1"]["state"] == want


# ---------------------------------------------------------------- the refresh guard (tools/refresh-masked.sh)
def make_web(tmp_path) -> Path:
    web = tmp_path / "web"
    (web / "public" / "data" / "v1").mkdir(parents=True)
    shutil.copy(Path(masked.WEB) / "public" / "data" / "v1" / "index.json", web / "public" / "data" / "v1" / "index.json")
    return web


def test_a_fixture_release_is_refused_without_the_flag(tmp_path, capsys):
    root, web = make_root(tmp_path), make_web(tmp_path)
    with pytest.raises(SystemExit) as e:
        masked.main(["--root", str(root), "--web", str(web)])
    assert "synthetic" in str(e.value).lower()
    assert not (web / "public" / "data" / "v1" / "masked.json").exists()


def test_a_fixture_release_never_writes_the_repos_own_masked_json(tmp_path):
    before = (Path(masked.WEB) / "public" / "data" / "v1" / "masked.json").exists()
    with pytest.raises(SystemExit) as e:
        masked.main(["--root", str(make_root(tmp_path)), "--allow-fixture"])           # default --web is this repo's web/
    assert "web/public/data/v1" in str(e.value) or "refus" in str(e.value).lower()
    assert (Path(masked.WEB) / "public" / "data" / "v1" / "masked.json").exists() == before


def test_a_fixture_release_may_write_to_a_scratch_web(tmp_path, capsys):
    web = make_web(tmp_path)
    assert masked.main(["--root", str(make_root(tmp_path)), "--web", str(web), "--allow-fixture"]) == 0
    got = json.loads((web / "public" / "data" / "v1" / "masked.json").read_text())
    assert got["provenance"]["synthetic"] is True and got["provenance"]["release_commit"] is None
    assert json.loads((web / "public" / "data" / "v1" / "index.json").read_text())["masked"] is True
    assert "pending" in capsys.readouterr().out


def test_a_real_looking_release_is_not_flagged(tmp_path):
    root = make_root(tmp_path)
    for s in ("aaron", "agent"):
        p = root / "dataset" / "masks" / f"allowed-{s}.json"
        d = json.loads(p.read_text())
        d["rule"] = "Aaron drew the region the prompt lets the drawing move."
        p.write_text(json.dumps(d))
    assert masked.is_fixture(root) is False
    assert masked.is_fixture(make_root(tmp_path / "again")) is True
