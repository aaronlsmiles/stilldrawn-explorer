"""Self-hosted Geist and Geist Mono for the explorer (Aaron's house faces from 29 Oct 2026): the upstream
variable fonts (OFL, no Reserved Font Name) from google/fonts at pinned commits, hash-checked, cut to the
weights and characters the site uses, with one change to Geist: its `tnum` feature swaps the digits only.

Schibsted Grotesk, the face before, gave . , : % and × a digit's width under `tnum`, so every tabular
number read "0 . 78"; the same patch keeps Geist's figures tabular and its punctuation narrow whatever
upstream does. Geist Mono needs no patch (every glyph is one width) and sets hashes and the terminal.

    PYTHONHASHSEED=0 uv run --no-project --with fonttools==4.67.0 --with brotli==1.2.0 python tools/font/build_font.py

Reproducible: the same bytes on every run (the hash seed fixes set order; the timestamps are upstream's).
"""
import hashlib
import io
import os
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# (google/fonts commit, directory, file, sha256, weight range, output, patch tnum)
FONTS = [
    ("718e1db4deb9e4d9d85a0ead1b9f5fde2761ccfd", "geist", "Geist%5Bwght%5D.ttf",
     "73894e0448cae90a92b6c2f8732b7bb9acb7b94c418bff559dad4a18e1de9659", (400, 800), "geist-latin.woff2", True),
    ("9e25e2ba265e5298f70f6182dd4e8a3ebf1b9123", "geistmono", "GeistMono%5Bwght%5D.ttf",
     "d00e590b8eb3a59acc329b2d044fd143ae935090b7da33199ebee27cc7de8196", (400, 600), "geist-mono-latin.woff2", False),
]
# Google Fonts' latin range, plus the math signs the site prints (≤ ≥ ≈ ≠ when the font has them)
UNICODES = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+2248,U+2260,U+2264,U+2265,U+2713"
OUT = Path(__file__).resolve().parents[2] / "web/public/fonts"


def fetch(commit: str, folder: str, name: str) -> bytes:
    with urllib.request.urlopen(f"https://raw.githubusercontent.com/google/fonts/{commit}/ofl/{folder}/{name}") as r:
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


def build(commit, folder, name, sha, weights, out, patch) -> None:
    raw = fetch(commit, folder, name)
    got = hashlib.sha256(raw).hexdigest()
    if got != sha:
        sys.exit(f"upstream {name} hash {got} != pinned {sha}")
    font = TTFont(io.BytesIO(raw), recalcTimestamp=False)
    font = instancer.instantiateVariableFont(font, {"wght": weights})
    # compile and reload: the instancer leaves gvar half-loaded, and subsetting it then fails on a missing glyph
    buf = io.BytesIO()
    font.save(buf)
    font = TTFont(io.BytesIO(buf.getvalue()), recalcTimestamp=False)
    if patch:
        print(out, "tnum substitutions dropped (non-digits):", digits_only_tnum(font))
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.flavor = "woff2"
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    dest = OUT / out
    font.flavor = "woff2"
    font.save(dest)
    print(dest, dest.stat().st_size, "bytes; sha256", hashlib.sha256(dest.read_bytes()).hexdigest())


def main() -> None:
    if os.environ.get("PYTHONHASHSEED") != "0":
        sys.exit("run with PYTHONHASHSEED=0 so the output is reproducible")
    OUT.mkdir(parents=True, exist_ok=True)
    for f in FONTS:
        build(*f)
    # one licence: both faces are Vercel's, under the same OFL text
    (OUT / "OFL.txt").write_bytes(fetch(FONTS[0][0], FONTS[0][1], "OFL.txt"))


if __name__ == "__main__":
    main()
