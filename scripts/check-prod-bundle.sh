#!/usr/bin/env bash
# Checks the test-mode marker in a Vite build output directory.
#
#   scripts/check-prod-bundle.sh [dist-dir]        prod (default): FAIL (exit 1) if the marker is present
#   scripts/check-prod-bundle.sh --test [dist-dir] test build: expects the marker; WARN (exit 0) if missing
#
# The marker must never leak into prod bundles. Grepping for 'VITE_TEST_MODE'
# is intentionally NOT used: Vite inlines env values, so that check is unreliable.
set -euo pipefail

MARKER='__YHH_TEST_MODE__'
MODE=prod
DIST=dist

for arg in "$@"; do
  case "$arg" in
    --test) MODE=test ;;
    -h|--help)
      sed -n '2,7p' "$0"
      exit 0
      ;;
    *) DIST="$arg" ;;
  esac
done

if [ ! -d "$DIST" ]; then
  echo "ERROR: build output directory '$DIST' not found. Run 'npm run build' first." >&2
  exit 1
fi

HITS=$(grep -rlF -- "$MARKER" "$DIST" || true)

if [ "$MODE" = "prod" ]; then
  if [ -n "$HITS" ]; then
    echo "FAIL: test-mode marker '$MARKER' found in prod build output:" >&2
    echo "$HITS" | sed 's/^/  /' >&2
    exit 1
  fi
  echo "OK: marker '$MARKER' not present in '$DIST' (prod build clean)."
  exit 0
fi

# test mode
if [ -n "$HITS" ]; then
  echo "OK: marker '$MARKER' present in test build '$DIST'."
  exit 0
fi
echo "WARN: marker '$MARKER' missing in test build '$DIST'. Skipping test-direction check (pending t_50a711f3 merge)." >&2
exit 0
