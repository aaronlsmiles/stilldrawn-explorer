"""Load every clip in the public release into one record per clip."""
import csv
import json
from dataclasses import dataclass, field
from pathlib import Path

from . import release_root
from .headlines import headlines
from .ids import ClipId, parse_clip_id

METRIC_DIRS = ("metrics", "metrics-r2", "metrics-ground", "metrics-hazard", "metrics-seedance")


@dataclass
class Clip:
    cid: ClipId
    mp4: Path                 # absolute path to the released file
    panel_file: str           # e.g. dataset/panels/act-black-1.png
    width: int
    height: int
    n_frames: int
    fps: float
    bytes: int
    sha256: str
    h: dict                   # headline scalars (headlines.HEADLINE_KEYS)
    motion_norm: float
    motion_px: float
    metrics_path: Path = field(repr=False)
    motion_path: Path = field(repr=False)

    @property
    def id(self) -> str:
        return self.cid.id


def _hashes(root: Path) -> dict[str, str]:
    with (root / "runs" / "CLIP-HASHES.csv").open() as fh:
        return {Path(r["file"]).stem: r["sha256"] for r in csv.DictReader(fh)}


def load_clips(root: Path | None = None) -> list[Clip]:
    root = Path(root or release_root())
    hashes = _hashes(root)
    clips = []
    for d in METRIC_DIRS:
        for mp in sorted((root / "runs" / d).glob("*.json")):
            if mp.name.startswith("pilot"):
                continue
            cid = parse_clip_id(mp.stem)
            mj = json.loads(mp.read_text())
            motion_path = root / "runs" / "metrics-motion" / f"{cid.id}.json"
            mo = json.loads(motion_path.read_text())["motion"]
            mp4 = root / mj["clip"]
            height, width = mj["resolution"]
            clips.append(Clip(
                cid=cid, mp4=mp4, panel_file=mj["panel"], width=width, height=height,
                n_frames=mj["n_frames"], fps=mj["fps"], bytes=mp4.stat().st_size,
                sha256=hashes[cid.id], h=headlines(mj),
                motion_norm=mo["headline_median_norm"], motion_px=mo["headline_median_px"],
                metrics_path=mp, motion_path=motion_path,
            ))
    return clips


def basis(clips: list[Clip]) -> list[Clip]:
    """The paper's cross-engine basis: primary standard cells (FLINT excluded)."""
    return [c for c in clips if c.cid.arm == "primary"]
