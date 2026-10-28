import json
from pathlib import Path

import pytest

from stilldrawn_web import release_root
from stilldrawn_web.load import load_clips


@pytest.fixture(scope="session")
def root() -> Path:
    r = release_root()
    if not (r / "runs" / "CLIP-HASHES.csv").exists():
        pytest.skip(f"public StillDrawn release not found at {r} (set STILLDRAWN_ROOT)")
    return r


@pytest.fixture(scope="session")
def clips(root):
    return load_clips(root)


@pytest.fixture(scope="session")
def confound(root):
    return json.loads((root / "analysis" / "out" / "motion_confound.json").read_text())
