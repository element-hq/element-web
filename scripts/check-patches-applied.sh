#!/usr/bin/env bash
# PATCH-RENAISSANCE-B assertion script
# Used by CI to validate patches stay applied post-rebase
set -euo pipefail

errors=0

check() {
  local pattern="$1"
  local paths="$2"
  local label="$3"
  if grep -rq "$pattern" $paths 2>/dev/null; then
    echo "OK $label"
  else
    echo "FAIL $label — pattern '$pattern' absent in $paths"
    errors=$((errors + 1))
  fi
}

check "PATCH-RENAISSANCE-B" "apps/web/src/components/structures/auth/ apps/web/src/components/views/elements/" "Patch B (onboarding React) markers present"
check "_patch_renaissance_b_marker" "apps/web/config.sample.json" "Patch B config.sample.json marker present"
check "chat.attalpresident.fr" "apps/web/config.sample.json" "Homeserver pre-cabled in config"
check "attalpresident.fr" "apps/web/config.sample.json" "server_name pre-cabled in config"

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "$errors Renaissance patches missing — rebase likely broke them"
  exit 1
fi

echo ""
echo "All Renaissance patches in place"
