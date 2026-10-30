#!/usr/bin/env bash
# Vendor blindpanel into web/: pack the kit from a CLEAN commit, build the StillDrawn study,
# copy study.json and reveal.json to web/public/data/blindpanel/stilldrawn/, and write
# web/vendor/blindpanel.lock.json (version, tag, commit, sha256s). Re-run after any kit change.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
kit="${BLINDPANEL_DIR:-$here/../blindpanel}"
vendor="$here/web/vendor"
studydir="$here/web/public/data/blindpanel/stilldrawn"
[ -z "$(git -C "$kit" status --porcelain)" ] || { echo "blindpanel has uncommitted changes; commit first" >&2; exit 1; }
commit="$(git -C "$kit" rev-parse HEAD)"
tag="$(git -C "$kit" describe --tags --exact-match 2>/dev/null || true)"
version="$(node -p "require('$kit/package.json').version")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
(cd "$kit" && npm run build --silent && npm pack --silent --pack-destination "$tmp" >/dev/null)
(cd "$kit" && node bin/blindpanel.mjs build examples/stilldrawn/study.yaml --out "$tmp/study" >/dev/null)
mkdir -p "$vendor" "$studydir"
rm -f "$vendor"/blindpanel-*.tgz
# RELEASE_TARBALL=<path>: vendor the published release tarball instead of the local pack, so the
# lock's sha256 is the one in the release's SHA256SUMS. The two differ only in gzip bytes (macOS
# and Linux zlib), so the release is used only if its contents match the local pack file for file.
if [ -n "${RELEASE_TARBALL:-}" ]; then
  mkdir -p "$tmp/a" "$tmp/b"
  tar xzf "$tmp/blindpanel-$version.tgz" -C "$tmp/a"
  tar xzf "$RELEASE_TARBALL" -C "$tmp/b"
  diff -r "$tmp/a" "$tmp/b" >/dev/null || { echo "release tarball's contents differ from the local pack; not vendoring it" >&2; exit 1; }
  cp "$RELEASE_TARBALL" "$vendor/blindpanel-$version.tgz"
else
  cp "$tmp/blindpanel-$version.tgz" "$vendor/"
fi
cp "$tmp/study/study.json" "$tmp/study/reveal.json" "$studydir/"
cp "$kit/examples/stilldrawn/banned-terms.txt" "$vendor/stilldrawn-banned-terms.txt"
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
if [ -n "$tag" ]; then tagjson="\"$tag\""; else tagjson=null; fi
cat > "$vendor/blindpanel.lock.json" <<JSON
{
  "package": "blindpanel",
  "version": "$version",
  "tag": $tagjson,
  "commit": "$commit",
  "tarball": "blindpanel-$version.tgz",
  "release": $( [ -n "${RELEASE_TARBALL:-}" ] && [ -n "$tag" ] && echo "\"https://github.com/aaronlsmiles/blindpanel/releases/tag/$tag\"" || echo null ),
  "tarball_sha256": "$(sha "$vendor/blindpanel-$version.tgz")",
  "study": {
    "source": "examples/stilldrawn/study.yaml",
    "study_sha256": "$(sha "$studydir/study.json")",
    "reveal_sha256": "$(sha "$studydir/reveal.json")"
  }
}
JSON
# reinstall from the fresh tarball (npm caches file: tarballs by path, so remove first)
(cd "$here/web" && rm -rf node_modules/blindpanel && npm install --silent --save-exact "blindpanel@file:vendor/blindpanel-$version.tgz")
# Vite pre-bundles dependencies: drop its cache, or a dev server keeps serving the old kit (restart a running one)
rm -rf "$here/web/node_modules/.vite"
echo "vendored blindpanel $version @ ${commit:0:7}${tag:+ ($tag)}"
