"""Self-hosted Schibsted Grotesk for the explorer: the upstream variable font (OFL, no Reserved
Font Name) from google/fonts at a pinned commit, hash-checked, cut to weights 400-800 and to the
characters the site uses, with one change: its `tnum` feature swaps the digits only.

Upstream, `tnum` also gives . , : % and × a digit's width (8.9 px at 14 px against 3.4 for the
period), so every tabular number read "0 . 78". Digits stay tabular, so columns still align.

    PYTHONHASHSEED=0 uv run --no-project --with fonttools==4.67.0 --with brotli==1.2.0 python tools/font/build_font.py

Reproducible: the same bytes on every run (the hash seed fixes set order; the timestamp is upstream's).
"""
import hashlib
import io
import os
import shutil
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

COMMIT = "cc054e5ee906ac9b9024971b64d821aa2561c582"
BASE = f"https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/schibstedgrotesk/"
TTF = "SchibstedGrotesk%5Bwght%5D.ttf"
TTF_SHA256 = "6ceeadf6be8e1fd7687011c7fa38ed0edd1abe967a0b73d97caec183552e823d"
# Google Fonts' latin range, plus the math signs the site prints (≤ ≥ ≈ ≠ when the font has them)
UNICODES = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+2248,U+2260,U+2264,U+2265,U+2713"
OUT = Path(__file__).resolve().parents[2] / "web/public/fonts"


def fetch(name: str) -> bytes:
    with urllib.request.urlopen(BASE + name) as r:
        return r.read()


def digits_only_tnum(font: TTFont) -> int:
    """Drop every tnum substitution whose input is not a digit; returns how many were dropped."""
    cmap = font.getBestCmap()
    digits = {cmap[c] for c in range(0x30, 0x3A)}
    gsub = font["GSUB"].table
    lookups = {i for fr in gsub.FeatureList.FeatureRecord if fr.FeatureTag == "tnum" for i in fr.Feature.LookupListIndex}
    dropped = 0
    for i in lookups:
        lookup = gsub.LookupList.Lookup[i]
        for st in lookup.SubTable:
            st = st.ExtSubTable if lookup.LookupType == 7 else st
            if not hasattr(st, "mapping"):
                sys.exit(f"tnum lookup {i} is type {lookup.LookupType}, not a single substitution")
            keep = {g: s for g, s in st.mapping.items() if g in digits}
            dropped += len(st.mapping) - len(keep)
            st.mapping = keep
    return dropped


def main() -> None:
    if os.environ.get("PYTHONHASHSEED") != "0":
        sys.exit("run with PYTHONHASHSEED=0 so the output is reproducible")
    raw = fetch(TTF)
    got = hashlib.sha256(raw).hexdigest()
    if got != TTF_SHA256:
        sys.exit(f"upstream font hash {got} != pinned {TTF_SHA256}")
    font = TTFont(io.BytesIO(raw), recalcTimestamp=False)
    font = instancer.instantiateVariableFont(font, {"wght": (400, 800)})
    print("tnum substitutions dropped (non-digits):", digits_only_tnum(font))
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.flavor = "woff2"
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / "schibsted-grotesk-latin.woff2"
    font.flavor = "woff2"
    font.save(dest)
    (OUT / "OFL.txt").write_bytes(fetch("OFL.txt"))
    print(dest, dest.stat().st_size, "bytes; sha256", hashlib.sha256(dest.read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
