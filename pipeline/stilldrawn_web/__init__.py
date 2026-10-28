"""StillDrawn Explorer data pipeline: public release -> web data contract."""
import os
from pathlib import Path


def release_root() -> Path:
    """Local copy of the public StillDrawn release (never the private repo)."""
    return Path(os.environ.get("STILLDRAWN_ROOT", Path.home() / "projects" / "stilldrawn"))
