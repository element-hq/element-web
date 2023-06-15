#!/usr/bin/env bash

# Runs package.sh, passing DIST_VERSION determined by git

set -ex

rm dist/element-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist

CI_PACKAGE=true DIST_VERSION="react-$(git rev-parse --short=12 HEAD)" scripts/package.sh
