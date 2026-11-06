"""tools/refresh-masked.sh: the guards that stop before anything is built or written."""
import os
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "tools" / "refresh-masked.sh"
FIXTURE_RELEASE = REPO / "pipeline" / "tests" / "fixtures" / "masked" / "release"
GIT_ENV = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"}


def git(*args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, env=GIT_ENV)


def run(root, *args):
    return subprocess.run([str(SCRIPT), *args], capture_output=True, text=True, env={**os.environ, "STILLDRAWN_ROOT": str(root)})


@pytest.fixture
def release(tmp_path):
    """A clean checkout at origin/main, standing in for the published release."""
    origin = tmp_path / "origin.git"
    git("init", "--bare", "-b", "main", str(origin), cwd=tmp_path)
    work = tmp_path / "release"
    git("clone", str(origin), str(work), cwd=tmp_path)
    (work / "README.md").write_text("release\n")
    git("add", ".", cwd=work)
    git("commit", "-m", "release", cwd=work)
    git("push", "origin", "HEAD:main", cwd=work)
    return work


def test_bad_argument(release):
    r = run(release, "--force")
    assert r.returncode == 2 and "usage" in r.stderr


def test_missing_folder(tmp_path):
    r = run(tmp_path / "nowhere")
    assert r.returncode == 1 and "no such release folder" in r.stderr


def test_a_fixture_release_needs_the_flag():
    r = run(FIXTURE_RELEASE)
    assert r.returncode == 1 and "synthetic fixture release" in r.stderr


def test_the_flag_is_refused_for_a_real_looking_release(release):
    r = run(release, "--allow-fixture")
    assert r.returncode == 1 and "not a fixture release" in r.stderr


def test_not_a_git_checkout(tmp_path):
    (tmp_path / "plain").mkdir()
    r = run(tmp_path / "plain")
    assert r.returncode == 1 and "not a git checkout" in r.stderr


def test_a_dirty_release_is_refused(release):
    (release / "README.md").write_text("edited\n")
    r = run(release)
    assert r.returncode == 1 and "uncommitted" in r.stderr


def test_a_release_ahead_of_origin_is_refused(release):
    (release / "more.txt").write_text("unpublished\n")
    git("add", ".", cwd=release)
    git("commit", "-m", "local only", cwd=release)
    r = run(release)
    assert r.returncode == 1 and "not at origin/main" in r.stderr


def test_nothing_is_written_to_the_repos_web_by_any_refusal(release):
    target = REPO / "web" / "public" / "data" / "v1" / "masked.json"
    before = target.exists()
    run(FIXTURE_RELEASE)
    run(release, "--allow-fixture")
    assert target.exists() == before
