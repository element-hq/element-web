#!/usr/bin/env bash

# Runs package.sh, passing DIST_VERSION determined by git

set -ex

rm dist/element-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist

DIST_VERSION=`$(dirname $0)/get-version-from-git.sh`

CI_PACKAGE=true DIST_VERSION=$DIST_VERSION scripts/package.sh
