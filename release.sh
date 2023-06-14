#!/bin/bash
#
# Script to perform a release of matrix-react-sdk.

set -e

cd "$(dirname "$0")"

# This link seems to get eaten by the release process, so ensure it exists.
yarn link matrix-js-sdk

./node_modules/matrix-js-sdk/release.sh "$@"
