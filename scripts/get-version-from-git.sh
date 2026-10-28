#!/usr/bin/env bash

# Echoes a version based on the git hashes of the element-web & js-sdk checkouts, for the case where
# these dependencies are git checkouts.

set -e

SCRIPT_DIR=$(dirname "$0")

if [ -d "$SCRIPT_DIR/../matrix-js-sdk" ]; then
    # layered.sh clones matrix-js-sdk directly into <root>/matrix-js-sdk.
    JSSDK_SHA=$(git -C "$SCRIPT_DIR/../matrix-js-sdk" rev-parse --short=12 HEAD)
else
    # fallback to reading the package.json
    JSSDK_SHA=$(jq -r '.dependencies["matrix-js-sdk"]' "$SCRIPT_DIR/../apps/web/package.json")
fi
VECTOR_SHA=$(git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop
echo "$VECTOR_SHA-js-$JSSDK_SHA"
