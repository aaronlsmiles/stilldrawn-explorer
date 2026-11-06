#!/usr/bin/env bash
# The Phase 12 refresh: export /tax/masked's contract from the published release, then run the checks.
#
#   STILLDRAWN_ROOT=~/projects/stilldrawn tools/refresh-masked.sh        # the real thing, once A9's outputs are published
#   STILLDRAWN_ROOT=pipeline/tests/fixtures/masked/release tools/refresh-masked.sh --allow-fixture   # a rehearsal
#
# Real mode needs the release checkout clean and equal to origin/main (the published A9 outputs, never a working tree).
# It writes web/public/data/v1/masked.json and sets index.masked, runs the pipeline and web tests, and prints what moved.
# A synthetic release is refused, and with --allow-fixture it is built into a scratch folder: this repo's own
# web/public/data/v1/masked.json is never written from fixtures. Nothing here pushes or deploys.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
allow=0
for a in "$@"; do
  case "$a" in
    --allow-fixture) allow=1 ;;
    *) echo "usage: STILLDRAWN_ROOT=<release checkout> $0 [--allow-fixture]" >&2; exit 2 ;;
  esac
done
root="${STILLDRAWN_ROOT:-$HOME/projects/stilldrawn}"
root="$(cd "$root" 2>/dev/null && pwd)" || { echo "refresh-masked: no such release folder: ${STILLDRAWN_ROOT:-$HOME/projects/stilldrawn}" >&2; exit 1; }

fixture=0
if grep -qs "Synthetic shapes for the explorer's fixtures" "$root/dataset/masks/allowed-aaron.json" "$root/dataset/masks/allowed-agent.json"; then fixture=1; fi

scratch="$(mktemp -d)"; trap 'rm -rf "$scratch"' EXIT
old="$scratch/old-masked.json"; web="$here/web"; target="$here/web/public/data/v1/masked.json"
[ -f "$target" ] && cp "$target" "$old" || true

if [ "$fixture" = 1 ]; then
  [ "$allow" = 1 ] || { echo "refresh-masked: $root is a synthetic fixture release; refusing (rehearse with --allow-fixture)" >&2; exit 1; }
  # a rehearsal: a complete tree in a scratch folder, built into a scratch web, never into this repo's web/
  tree="$scratch/release"; cp -R "$root" "$tree"
  state="${FIXTURE_STATE:-pending}"
  cp "$here/pipeline/tests/fixtures/masked/adherence/$state/a9_adherence.json" "$tree/analysis/out/"
  web="$scratch/web"; mkdir -p "$web/public/data/v1"; cp "$here/web/public/data/v1/index.json" "$web/public/data/v1/"
  target="$web/public/data/v1/masked.json"; root="$tree"
  extra=(--allow-fixture)
else
  [ "$allow" = 0 ] || { echo "refresh-masked: --allow-fixture given, but $root is not a fixture release" >&2; exit 1; }
  git -C "$root" rev-parse --git-dir >/dev/null 2>&1 || { echo "refresh-masked: $root is not a git checkout" >&2; exit 1; }
  [ -z "$(git -C "$root" status --porcelain)" ] || { echo "refresh-masked: $root has uncommitted changes; the release must be clean" >&2; exit 1; }
  git -C "$root" fetch --quiet origin main
  [ "$(git -C "$root" rev-parse HEAD)" = "$(git -C "$root" rev-parse origin/main)" ] \
    || { echo "refresh-masked: $root is not at origin/main; pull the published release first" >&2; exit 1; }
  extra=()
fi

echo "== export from $root"
(cd "$here/pipeline" && uv run python -m stilldrawn_web.masked --root "$root" --web "$web" ${extra[@]+"${extra[@]}"})
[ -f "$target" ] || { echo "refresh-masked: the release has no A9 outputs yet; nothing exported" >&2; exit 1; }

echo "== pipeline tests"
(cd "$here/pipeline" && uv run pytest tests/test_masked.py tests/test_masked_fixtures.py -q)

echo "== what moved (old to new)"
summ() { (cd "$here/pipeline" && uv run python -c 'import json,sys; from stilldrawn_web import masked; print("\n".join(masked.summary(json.load(open(sys.argv[1])))))' "$1"); }
if [ -f "$old" ]; then summ "$old" > "$scratch/old.txt"; else echo "(no previous masked.json)" > "$scratch/old.txt"; fi
summ "$target" > "$scratch/new.txt"
diff -u --label old --label new "$scratch/old.txt" "$scratch/new.txt" || true

echo "== web tests (the facts tests say which figure moved)"
(cd "$here/web" && npx vitest run src/views/Tax src/views/About src/plainwords src/data)

cat <<'EOF'

Done. Now:
  1. Read the diff above against the release's own a9_masked_drift.md and a9_adherence.md.
  2. If a figure moved, update MASKED-DRIFT.md and the thesis sentence (the facts tests name the figure).
  3. cd web && npm run e2e, then a preview. Aaron's word before anything is deployed.
EOF
if [ "$fixture" = 1 ]; then echo "(rehearsal: web/public/data/v1 was not touched)"; fi
