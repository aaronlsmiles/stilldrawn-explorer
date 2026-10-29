"""Derive the explorer's display media from the public release, and upload it to R2.

    uv run python -m stilldrawn_web.media                 # derive into pipeline/out/media/
    op run --env-file=<hub>/tools/stilldrawn-r2.env.op -- uv run python -m stilldrawn_web.media upload
    uv run python -m stilldrawn_web.media verify          # ranged GETs and sha256 against the public host

Layout (mirrors stilldrawn/v1.0.0/ on the media host):
  clips/<engine>/<id>.mp4   symlink to the released file: never re-encoded (288 carry C2PA)
  panels/<id>.png           symlink to dataset/panels/<id>.png
  panels/<id>.webp          display copy
  panels/<id>-w<W>.webp     the display copy at W px wide, W in PANEL_WIDTHS below its own width
  posters/<id>.webp         frame 96, 640 px wide (frame 0 is just the panel again)
  posters/<id>-w<W>.webp    the poster at W px wide, W in POSTER_WIDTHS
  frame0/<id>.png           frame 0 at native size, for the difference view

Frames are extracted with ffmpeg; WebP is encoded with cwebp (libwebp), because
Homebrew's ffmpeg is built without libwebp. Re-runs skip anything already newer than
its source.

Upload: every object goes to stilldrawn/v1.0.0/<layout path> with an immutable cache
header, its content type and its sha256 as metadata. Clips are hashed against
CLIP-HASHES.csv before anything is sent; a mismatch stops the run. Re-runs skip objects
whose size and hash already match.
"""
import hashlib
import os
import struct
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from . import release_root
from .load import load_clips

POSTER_FRAME = 96
# srcset steps (index.json "variants"): a phone's source panel needs 640 px at most at 2x, a
# contact-sheet frame 320, where the display copies are 1344 and 640 px wide
PANEL_WIDTHS = (320, 640, 960)
POSTER_WIDTH = 640
POSTER_WIDTHS = (320,)
# The clips carry no colour tags. Browsers decode untagged HD as BT.709 limited range;
# ffmpeg's default is BT.601, which would tint the difference view.
RGB_FILTER = "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24"
OUT = Path(__file__).resolve().parents[1] / "out" / "media"
PREFIX = "stilldrawn/v1.0.0/"
PUBLIC = "https://media.studionephele.com/"
CACHE = "public, max-age=31536000, immutable"
TYPES = {".mp4": "video/mp4", ".png": "image/png", ".webp": "image/webp"}
AI_CRAWLERS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "anthropic-ai", "Claude-Web", "CCBot",
               "Google-Extended", "Applebot-Extended", "Bytespider", "PerplexityBot", "Meta-ExternalAgent",
               "Amazonbot", "cohere-ai", "Diffbot", "ImagesiftBot", "Omgilibot", "Timpibot"]
# The release asks people not to train on these clips (NOTICE-PROVIDERS.md).
ROBOTS = "".join(f"User-agent: {b}\nDisallow: /\n\n" for b in AI_CRAWLERS) + "User-agent: *\nAllow: /\n"


def variant(path: str, w: int) -> str:
    """The contract's rule for a display copy at width w: panels/x.webp -> panels/x-w640.webp."""
    stem, ext = path.rsplit(".", 1)
    return f"{stem}-w{w}.{ext}"


def webp_size(path: Path) -> tuple[int, int]:
    b = Path(path).read_bytes()[:30]
    kind = b[12:16]
    if kind == b"VP8X":
        return int.from_bytes(b[24:27], "little") + 1, int.from_bytes(b[27:30], "little") + 1
    if kind == b"VP8 ":
        return int.from_bytes(b[26:28], "little") & 0x3FFF, int.from_bytes(b[28:30], "little") & 0x3FFF
    if kind == b"VP8L":
        bits = int.from_bytes(b[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    raise ValueError(f"not a WebP: {path}")


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


def _webp(dst: Path, src_png: Path, quality: int, width: int | None = None) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    resize = ["-resize", str(width), "0"] if width else []
    subprocess.run(["cwebp", "-quiet", "-q", str(quality), *resize, str(src_png), "-o", str(dst)], check=True)


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
        sizes = [(poster, None)] + [(out / variant(f"posters/{c.id}.webp", w), w) for w in POSTER_WIDTHS]
        stale = [(p, w) for p, w in sizes if not _fresh(p, c.mp4)]
        if stale:
            tmp = poster.with_suffix(".tmp.png")
            vf = f"select=eq(n\\,{POSTER_FRAME}),scale={POSTER_WIDTH}:-2:flags=lanczos,{RGB_FILTER}"
            _ffmpeg(tmp, ["-i", str(c.mp4), "-vf", vf, "-frames:v", "1"])
            for p, w in stale:
                _webp(p, tmp, 78, w)
                written += 1
            tmp.unlink()
    for pid in panels:
        src = panel_dir / f"{pid}.png"
        linked += _link(out / "panels" / f"{pid}.png", src)
        webp = out / "panels" / f"{pid}.webp"
        if not _fresh(webp, src):
            _webp(webp, src, 85)       # panels are at most 1344 px wide already
            written += 1
        for w in PANEL_WIDTHS:
            v = out / variant(f"panels/{pid}.webp", w)
            if w < png_size(src)[0] and not _fresh(v, src):
                _webp(v, src, 85, w)
                written += 1
    return {"written": written, "linked": linked, "clips": len(clips), "panels": len(panels)}


@dataclass(frozen=True)
class Item:
    key: str                  # path under the prefix, e.g. clips/wan22/<id>.mp4
    path: Path | None         # local file (None when body is given)
    content_type: str
    sha256: str | None = None  # the release's hash; set for clips, checked before upload
    body: bytes | None = None


def plan_uploads(out: Path = OUT, clips=None, panels=None, root: Path | None = None) -> list[Item]:
    clips = load_clips(Path(root or release_root())) if clips is None else clips
    panels = sorted({p.stem for p in (out / "panels").glob("*.png")}) if panels is None else panels
    items = []
    for c in clips:
        items += [Item(f"clips/{c.cid.engine}/{c.id}.mp4", out / "clips" / c.cid.engine / f"{c.id}.mp4", TYPES[".mp4"], c.sha256),
                  Item(f"posters/{c.id}.webp", out / "posters" / f"{c.id}.webp", TYPES[".webp"]),
                  Item(f"frame0/{c.id}.png", out / "frame0" / f"{c.id}.png", TYPES[".png"])]
        items += [Item(k, out / k, TYPES[".webp"]) for k in (variant(f"posters/{c.id}.webp", w) for w in POSTER_WIDTHS)]
    for pid in panels:
        items += [Item(f"panels/{pid}.png", out / "panels" / f"{pid}.png", TYPES[".png"]),
                  Item(f"panels/{pid}.webp", out / "panels" / f"{pid}.webp", TYPES[".webp"])]
        own = png_size(out / "panels" / f"{pid}.png")[0]
        items += [Item(k, out / k, TYPES[".webp"]) for k in (variant(f"panels/{pid}.webp", w) for w in PANEL_WIDTHS if w < own)]
    return items


def _sha(item: Item) -> str:
    if item.body is not None:
        return hashlib.sha256(item.body).hexdigest()
    h = hashlib.sha256()
    with open(item.path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _size(item: Item) -> int:
    return len(item.body) if item.body is not None else item.path.stat().st_size


def upload(items: list[Item], client, bucket: str, prefix: str = PREFIX, workers: int = 8, log=print) -> dict:
    """Hash everything first (clips must match the release), then send what is missing or changed."""
    with ThreadPoolExecutor(workers) as ex:
        shas = list(ex.map(_sha, items))
    bad = [i.key for i, h in zip(items, shas) if i.sha256 and i.sha256 != h]
    if bad:
        raise ValueError(f"sha256 differs from the release for {len(bad)} clip(s), e.g. {bad[0]}; nothing uploaded")

    def one(pair):
        item, sha = pair
        key = prefix + item.key
        try:
            head = client.head_object(Bucket=bucket, Key=key)
            if head["ContentLength"] == _size(item) and head.get("Metadata", {}).get("sha256") == sha:
                return "skipped"
        except Exception as e:  # 404: not there yet
            if getattr(e, "response", {}).get("Error", {}).get("Code") not in ("404", "NoSuchKey", "NotFound"):
                raise
        body = item.body if item.body is not None else open(item.path, "rb")
        try:
            client.put_object(Bucket=bucket, Key=key, Body=body, ContentType=item.content_type,
                              CacheControl=CACHE, Metadata={"sha256": sha})
        finally:
            if hasattr(body, "close"):
                body.close()
        return "uploaded"

    stats = {"uploaded": 0, "skipped": 0}
    with ThreadPoolExecutor(workers) as ex:
        for n, result in enumerate(ex.map(one, zip(items, shas)), 1):
            stats[result] += 1
            if n % 100 == 0 or n == len(items):
                log(f"{n}/{len(items)} {stats}")
    return stats


def r2_client():
    import boto3
    from botocore.config import Config
    return boto3.client(
        "s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"], aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto", config=Config(retries={"max_attempts": 5, "mode": "standard"}, max_pool_connections=16))


def verify_public(clips, base: str = PUBLIC + PREFIX, sample: int = 6) -> list[str]:
    """Ranged GET (expect 206) and full sha256 of a spread of clips, through the public host."""
    picked = sorted(clips, key=lambda c: c.bytes)[:: max(1, len(clips) // sample)][:sample]
    lines = []
    for c in picked:
        url = f"{base}clips/{c.cid.engine}/{c.id}.mp4"
        req = urllib.request.Request(url, headers={"Range": "bytes=0-1023", "User-Agent": "stilldrawn-verify"})
        with urllib.request.urlopen(req) as r:
            ranged = r.status
            cache = r.headers.get("Cache-Control")
        req = urllib.request.Request(url, headers={"User-Agent": "stilldrawn-verify"})
        with urllib.request.urlopen(req) as r:
            ok = hashlib.sha256(r.read()).hexdigest() == c.sha256
            ctype = r.headers.get("Content-Type")
        lines.append(f"{'OK ' if ranged == 206 and ok else 'BAD'} {c.id} range={ranged} sha256={'match' if ok else 'DIFFERS'} {ctype} | {cache}")
    return lines


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "derive"
    if cmd == "upload":
        client, bucket = r2_client(), os.environ.get("R2_BUCKET", "stilldrawn-media")
        print(upload(plan_uploads(), client, bucket))
        print(upload([Item("robots.txt", None, "text/plain; charset=utf-8", body=ROBOTS.encode())], client, bucket, prefix=""))
    elif cmd == "verify":
        print("\n".join(verify_public(load_clips(release_root()))))
    else:
        print(derive(Path(cmd) if cmd != "derive" else None))
