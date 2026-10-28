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
