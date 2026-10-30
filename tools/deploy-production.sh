#!/usr/bin/env bash
# PUBLIC production deploy to the personal Hobby team: stilldrawn.studionephele.com (gate G5).
# Run only with Aaron's word for this deploy: G5_GO_LIVE=yes tools/deploy-production.sh
# Needs the same two files as deploy-preview.sh, the three production env vars set in the Vercel
# project (REDEPLOY.md, "Production"), and the custom domain added to the project.
set -euo pipefail
[ "${G5_GO_LIVE:-}" = yes ] || { echo "refusing: a production deploy is public; set G5_GO_LIVE=yes only with Aaron's word" >&2; exit 2; }
here="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$here/.env.local"; set +a
: "${VERCEL_SCOPE:?set VERCEL_SCOPE in .env.local}"
"$here/tools/stage-preview.sh" production
cd "$here/deploy/production"
ENV_OP="${ENV_OP:-$HOME/projects/studio/tools/stilldrawn-explorer.env.op}"
run() { op run --env-file="$ENV_OP" -- "$@"; }
[ -f .vercel/project.json ] || run vercel link --yes --scope "$VERCEL_SCOPE" --project stilldrawn-explorer
run vercel deploy --yes --prod --scope "$VERCEL_SCOPE"
