#!/usr/bin/env bash
# Checks the test-mode marker in a Vite build output directory.
#
#   scripts/check-prod-bundle.sh [dist-dir]        prod (default): FAIL (exit 1) if the marker is present
#   scripts/check-prod-bundle.sh --test [dist-dir] test build: FAIL (exit 1) if the marker is missing
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

# Guard against a vacuous pass: an empty or nginx-only dir (no app JS) must fail.
if ! compgen -G "$DIST/assets/*.js" >/dev/null; then
  echo "FAIL: no JS bundle found in '$DIST/assets' (nothing to check)." >&2
  exit 1
fi

# grep exit: 0 = hit, 1 = no hit, 2+ = read error. Only 1 means "clean";
# an unreadable file must fail the check, not silently pass it.
RC=0
HITS=$(grep -rlF -- "$MARKER" "$DIST") || RC=$?
if [ "$RC" -gt 1 ]; then
  echo "ERROR: grep failed (exit $RC) while scanning '$DIST'." >&2
  exit 1
fi

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
echo "FAIL: test-mode marker '$MARKER' missing in test build '$DIST'." >&2
exit 1
