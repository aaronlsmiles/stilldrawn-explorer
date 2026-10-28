"""Derive the explorer's display media from the public release, laid out as on R2.

    uv run python -m stilldrawn_web.media      # writes pipeline/out/media/

Layout (mirrors stilldrawn/v1.0.0/ on the media host):
  clips/<engine>/<id>.mp4   symlink to the released file: never re-encoded (288 carry C2PA)
  panels/<id>.png           symlink to dataset/panels/<id>.png
  panels/<id>.webp          display copy
  posters/<id>.webp         frame 96, 640 px wide (frame 0 is just the panel again)
  frame0/<id>.png           frame 0 at native size, for the difference view

Frames are extracted with ffmpeg; WebP is encoded with cwebp (libwebp), because
Homebrew's ffmpeg is built without libwebp. Re-runs skip anything already newer than
its source.
"""
import struct
import subprocess
import sys
from pathlib import Path

from . import release_root
from .load import load_clips

POSTER_FRAME = 96
# The clips carry no colour tags. Browsers decode untagged HD as BT.709 limited range;
# ffmpeg's default is BT.601, which would tint the difference view.
RGB_FILTER = "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24"
OUT = Path(__file__).resolve().parents[1] / "out" / "media"


def png_size(path: Path) -> tuple[int, int]:
    with open(path, "rb") as f:
        f.read(16)
        return struct.unpack(">II", f.read(8))


def _fresh(dst: Path, src: Path) -> bool:
    return dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime


def _link(dst: Path, src: Path) -> bool:
    if dst.is_symlink() and dst.resolve() == src.resolve():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.is_symlink() or dst.exists():
        dst.unlink()
    dst.symlink_to(src.resolve())
    return True


def _ffmpeg(dst: Path, args: list[str]) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args, str(dst)], check=True)


def _webp(dst: Path, src_png: Path, quality: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["cwebp", "-quiet", "-q", str(quality), str(src_png), "-o", str(dst)], check=True)


def derive(root: Path | None = None, out: Path = OUT, clips=None, panels=None) -> dict:
    root = Path(root or release_root())
    clips = load_clips(root) if clips is None else clips
    panel_dir = root / "dataset" / "panels"
    panels = sorted(p.stem for p in panel_dir.glob("*.png")) if panels is None else panels
    written = linked = 0
    for c in clips:
        linked += _link(out / "clips" / c.cid.engine / f"{c.id}.mp4", c.mp4)
        f0 = out / "frame0" / f"{c.id}.png"
        if not _fresh(f0, c.mp4):
            _ffmpeg(f0, ["-i", str(c.mp4), "-frames:v", "1", "-vf", RGB_FILTER])
            written += 1
        poster = out / "posters" / f"{c.id}.webp"
        if not _fresh(poster, c.mp4):
            tmp = poster.with_suffix(".tmp.png")
            vf = f"select=eq(n\\,{POSTER_FRAME}),scale=640:-2:flags=lanczos,{RGB_FILTER}"
            _ffmpeg(tmp, ["-i", str(c.mp4), "-vf", vf, "-frames:v", "1"])
            _webp(poster, tmp, 78)
            tmp.unlink()
            written += 1
    for pid in panels:
        src = panel_dir / f"{pid}.png"
        linked += _link(out / "panels" / f"{pid}.png", src)
        webp = out / "panels" / f"{pid}.webp"
        if not _fresh(webp, src):
            _webp(webp, src, 85)       # panels are at most 1344 px wide already
            written += 1
    return {"written": written, "linked": linked, "clips": len(clips), "panels": len(panels)}


if __name__ == "__main__":
    print(derive(Path(sys.argv[1]) if len(sys.argv) > 1 else None))
