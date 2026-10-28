"""Clip-id grammar of the StillDrawn release.

    <panel>_<idle|burst|campush>_<suffix>[-r2|-hN]
    flint-<first>--<last>_<suffix>

Mirrors analysis/build_table.py::parse_cell, extended to the repeat, hazard,
ground and Seedance arms.
"""
from dataclasses import dataclass

ENGINE_SUFFIX = {
    "gen4t": "gen4_turbo",
    "gen45": "gen4.5",
    "h3": "h3-fal",
    "wan22": "wan22",
    "ltx23": "ltx23",
    "sd2": "seedance",
}
MOTIONS = {"idle": "IDLE", "burst": "BURST", "campush": "CAMPUSH"}


@dataclass(frozen=True)
class ClipId:
    id: str             # the clip stem, e.g. act-black-1_campush_gen45-r2
    cell: str           # the cell it is a draw of, e.g. act-black-1_campush_gen45
    panel: str
    motion_class: str   # IDLE | BURST | CAMPUSH | FLINT
    engine: str         # engine directory name in runs/
    arm: str            # primary | repeat | hazard | ground | flint | seedance
    draw: str           # r1 | r2 | h1..h10
    flint_pair: tuple[str, str] | None = None


def parse_clip_id(stem: str) -> ClipId:
    body, tail = stem.rsplit("_", 1)
    suffix, _, draw = tail.partition("-")
    if suffix not in ENGINE_SUFFIX:
        raise ValueError(f"unknown engine suffix in {stem!r}")
    engine = ENGINE_SUFFIX[suffix]
    draw = draw or "r1"
    cell = f"{body}_{suffix}"

    flint_pair = None
    if stem.startswith("flint-"):
        first, last = body[len("flint-"):].split("--")
        panel, motion, flint_pair = first, "FLINT", (first, last)
    else:
        panel, motion_key = body.rsplit("_", 1)
        motion = MOTIONS[motion_key]

    if engine == "seedance":
        arm = "seedance"
    elif flint_pair:
        arm = "flint"
    elif panel.startswith("ground-"):
        arm = "ground"
    elif draw == "r2":
        arm = "repeat"
    elif draw.startswith("h"):
        arm = "hazard"
    else:
        arm = "primary"
    return ClipId(stem, cell, panel, motion, engine, arm, draw, flint_pair)
