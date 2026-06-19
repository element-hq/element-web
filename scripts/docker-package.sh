#!/usr/bin/env bash
# PATCH-RENAISSANCE-CI: override docker-package.sh upstream
# Upstream version tente git describe / git rev-parse sur un bind-mount .git ro
# qui ne contient pas toujours les tags (cas branch renaissance/main fork).
# Renaissance build : VERSION lu depuis scripts/.renaissance-version (écrit par le
# workflow GH Actions avant docker build). Fallback "renaissance-dev" si absent.

set -ex

DIR=$(dirname "$0")

if [ -f "$DIR/.renaissance-version" ]; then
    DIST_VERSION=$(cat "$DIR/.renaissance-version" | head -n 1 | tr -d '[:space:]')
fi

DIST_VERSION="${DIST_VERSION:-renaissance-dev}"
DIST_VERSION=$("$DIR"/normalize-version.sh "$DIST_VERSION")

VERSION=$DIST_VERSION pnpm --dir apps/web build
