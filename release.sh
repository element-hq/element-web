#!/bin/bash
#
# Script to perform a release of element-web.

set -e

cd "$(dirname "$0")"

./node_modules/matrix-js-sdk/release.sh "$@"
