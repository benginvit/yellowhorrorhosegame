#!/usr/bin/env bash
# Checks the build-flag markers in a Vite build output directory.
#
#   scripts/check-prod-bundle.sh [dist-dir]                prod (default): FAIL (exit 1) if any marker is present
#   scripts/check-prod-bundle.sh --test [dist-dir]         test build: FAIL if the test marker is missing
#                                                          or the level-select marker is present
#   scripts/check-prod-bundle.sh --level-select [dist-dir] staging build: FAIL unless the level-select marker is
#                                                          present and the test marker is absent
#
# Markers: '__YHH_TEST_MODE__' (VITE_TEST_MODE=1) and '__YHH_LEVEL_SELECT__'
# (VITE_LEVEL_SELECT=1, staging). Neither may ever leak into prod bundles.
# Grepping for 'VITE_TEST_MODE' / 'VITE_LEVEL_SELECT' is intentionally NOT used:
# Vite inlines env values, so that check is unreliable.
set -euo pipefail

TEST_MARKER='__YHH_TEST_MODE__'
LEVEL_SELECT_MARKER='__YHH_LEVEL_SELECT__'
MODE=prod
DIST=dist

for arg in "$@"; do
  case "$arg" in
    --test) MODE=test ;;
    --level-select) MODE=level-select ;;
    -h|--help)
      sed -n '2,13p' "$0"
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

# Files containing a marker (empty when absent).
# grep exit: 0 = hit, 1 = no hit, 2+ = read error. Only 1 means "clean";
# an unreadable file must fail the check, not silently pass it.
hits() {
  local rc=0 out
  out=$(grep -rlF -- "$1" "$DIST") || rc=$?
  if [ "$rc" -gt 1 ]; then
    echo "ERROR: grep failed (exit $rc) while scanning '$DIST'." >&2
    exit 1
  fi
  printf '%s' "$out"
}

fail_present() {
  echo "FAIL: marker '$1' found in $2 build output:" >&2
  echo "$3" | sed 's/^/  /' >&2
  exit 1
}

TEST_HITS=$(hits "$TEST_MARKER")
LEVEL_HITS=$(hits "$LEVEL_SELECT_MARKER")

case "$MODE" in
  prod)
    [ -z "$TEST_HITS" ] || fail_present "$TEST_MARKER" prod "$TEST_HITS"
    [ -z "$LEVEL_HITS" ] || fail_present "$LEVEL_SELECT_MARKER" prod "$LEVEL_HITS"
    echo "OK: markers '$TEST_MARKER' and '$LEVEL_SELECT_MARKER' not present in '$DIST' (prod build clean)."
    ;;
  test)
    [ -z "$LEVEL_HITS" ] || fail_present "$LEVEL_SELECT_MARKER" test "$LEVEL_HITS"
    if [ -z "$TEST_HITS" ]; then
      echo "FAIL: test-mode marker '$TEST_MARKER' missing in test build '$DIST'." >&2
      exit 1
    fi
    echo "OK: marker '$TEST_MARKER' present in test build '$DIST'."
    ;;
  level-select)
    [ -z "$TEST_HITS" ] || fail_present "$TEST_MARKER" level-select "$TEST_HITS"
    if [ -z "$LEVEL_HITS" ]; then
      echo "FAIL: marker '$LEVEL_SELECT_MARKER' missing in level-select build '$DIST' (built without VITE_LEVEL_SELECT=1?)." >&2
      exit 1
    fi
    echo "OK: marker '$LEVEL_SELECT_MARKER' present and '$TEST_MARKER' absent in level-select build '$DIST'."
    ;;
esac
exit 0
