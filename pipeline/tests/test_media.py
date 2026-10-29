import subprocess

import pytest

from stilldrawn_web import media

ONE = "act-tone-2_campush_wan22"
PAIR = {ONE, "act-tone-2_campush_gen45"}


@pytest.fixture(scope="module")
def out(tmp_path_factory, root, clips):
    out = tmp_path_factory.mktemp("media")
    media.derive(root, out, clips=[c for c in clips if c.id in PAIR], panels=["act-tone-2"])
    return out


def test_clip_is_a_symlink_to_the_release_file(out, root):
    p = out / "clips" / "wan22" / f"{ONE}.mp4"
    assert p.is_symlink()
    assert p.resolve() == (root / "runs" / "wan22" / f"{ONE}.mp4").resolve()


def test_frame0_is_a_native_size_png(out):
    assert media.png_size(out / "frame0" / f"{ONE}.png") == (1280, 704)


def test_poster_and_panel_display_copies(out):
    assert (out / "posters" / f"{ONE}.webp").stat().st_size > 1000
    assert (out / "panels" / "act-tone-2.webp").stat().st_size > 1000
    assert (out / "panels" / "act-tone-2.png").is_symlink()


def test_display_copies_come_in_srcset_widths(out):
    # a phone's source panel and the contact sheet's frames need far fewer pixels than the display copy
    assert [media.webp_size(out / "panels" / f"act-tone-2-w{w}.webp")[0] for w in media.PANEL_WIDTHS] == [320, 640, 960]
    assert media.webp_size(out / "panels" / "act-tone-2-w640.webp")[1] == 366          # 768 × 640 / 1344
    assert media.webp_size(out / "posters" / f"{ONE}-w320.webp")[0] == 320
    assert media.webp_size(out / "posters" / f"{ONE}.webp")[0] == 640
    assert (out / "panels" / "act-tone-2-w640.webp").stat().st_size < (out / "panels" / "act-tone-2.webp").stat().st_size / 2


def test_variant_paths_follow_the_contract_rule():
    assert media.variant("panels/act-tone-2.webp", 640) == "panels/act-tone-2-w640.webp"
    assert media.variant("posters/a_b_c-r2.webp", 320) == "posters/a_b_c-r2-w320.webp"


def test_rerun_is_idempotent(out, root, clips):
    files = [p for p in out.rglob("*") if p.is_file() and not p.is_symlink()]
    before = {p: p.stat().st_mtime_ns for p in files}
    stats = media.derive(root, out, clips=[c for c in clips if c.id in PAIR], panels=["act-tone-2"])
    assert stats["written"] == 0 and stats["linked"] == 0
    assert {p: p.stat().st_mtime_ns for p in files} == before


def test_frame0_is_the_bt709_decode_of_frame_0(out, root):
    """Browsers decode untagged HD as BT.709 limited range; the reference must match it."""
    def raw(path, vf=None):
        cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-frames:v", "1"]
        cmd += ["-vf", vf] if vf else []
        return subprocess.run(cmd + ["-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                              capture_output=True, check=True).stdout
    ref = raw(root / "runs" / "wan22" / f"{ONE}.mp4", media.RGB_FILTER)
    assert raw(out / "frame0" / f"{ONE}.png") == ref


# ---- upload half (R2) ----------------------------------------------------------------
import hashlib

from botocore.exceptions import ClientError


class FakeR2:
    """Just enough of the S3 client: head_object and put_object over a dict."""

    def __init__(self):
        self.store, self.puts = {}, []

    def head_object(self, Bucket, Key):
        if (Bucket, Key) not in self.store:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
        o = self.store[(Bucket, Key)]
        return {"ContentLength": len(o["Body"]), "Metadata": o.get("Metadata", {})}

    def put_object(self, Bucket, Key, Body, **kw):
        data = Body.read() if hasattr(Body, "read") else Body
        self.store[(Bucket, Key)] = {"Body": data, **kw}
        self.puts.append(Key)


@pytest.fixture(scope="module")
def items(out, root, clips):
    return media.plan_uploads(out, clips=[c for c in clips if c.id in PAIR], panels=["act-tone-2"])


def test_plan_mirrors_the_media_layout(items):
    by = {i.key: i for i in items}
    assert by[f"clips/wan22/{ONE}.mp4"].content_type == "video/mp4"
    assert by[f"clips/wan22/{ONE}.mp4"].sha256 is not None
    assert by[f"posters/{ONE}.webp"].content_type == "image/webp"
    assert by[f"frame0/{ONE}.png"].content_type == "image/png"
    assert by["panels/act-tone-2.png"].content_type == "image/png"
    assert by["panels/act-tone-2.webp"].content_type == "image/webp"
    assert by[f"posters/{ONE}-w320.webp"].content_type == "image/webp"
    assert {f"panels/act-tone-2-w{w}.webp" for w in (320, 640, 960)} <= set(by)
    assert len(items) == 2 * (3 + 1) + 2 + 3


def test_upload_sets_immutable_headers_and_records_the_hash(items):
    r2 = FakeR2()
    stats = media.upload(items, r2, "b", workers=2, log=lambda *_: None)
    assert stats == {"uploaded": len(items), "skipped": 0}
    clip = r2.store[("b", f"stilldrawn/v1.0.0/clips/wan22/{ONE}.mp4")]
    assert clip["CacheControl"] == "public, max-age=31536000, immutable"
    assert clip["ContentType"] == "video/mp4"
    assert clip["Metadata"]["sha256"] == hashlib.sha256(clip["Body"]).hexdigest()


def test_rerun_skips_what_is_already_there(items):
    r2 = FakeR2()
    media.upload(items, r2, "b", workers=2, log=lambda *_: None)
    r2.puts.clear()
    assert media.upload(items, r2, "b", workers=2, log=lambda *_: None) == {"uploaded": 0, "skipped": len(items)}
    assert r2.puts == []


def test_a_changed_object_is_replaced(items):
    r2 = FakeR2()
    media.upload(items, r2, "b", workers=2, log=lambda *_: None)
    key = f"stilldrawn/v1.0.0/posters/{ONE}.webp"
    r2.store[("b", key)]["Body"] = b"short"
    r2.puts.clear()
    media.upload(items, r2, "b", workers=2, log=lambda *_: None)
    assert r2.puts == [key]


def test_a_clip_whose_bytes_do_not_match_the_release_is_refused(tmp_path):
    f = tmp_path / "x.mp4"
    f.write_bytes(b"not the release")
    bad = media.Item("clips/wan22/x.mp4", f, "video/mp4", "0" * 64)
    r2 = FakeR2()
    with pytest.raises(ValueError, match="sha256"):
        media.upload([bad], r2, "b", workers=1, log=lambda *_: None)
    assert r2.puts == []


def test_robots_object_turns_ai_crawlers_away():
    assert "GPTBot" in media.ROBOTS and "Disallow: /" in media.ROBOTS
