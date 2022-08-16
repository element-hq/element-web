#!/bin/bash

set -ex

BRANCH=$(git rev-parse --abbrev-ref HEAD)
DIST_VERSION=$(git describe --abbrev=0 --tags)

DIR=$(dirname "$0")

# If we're not using custom SDKs and on a branch other than master, generate a version akin go develop.element.io
if [[ $USE_CUSTOM_SDKS == false ]] && [[ $BRANCH != 'master' ]]
then
    DIST_VERSION=$("$DIR"/get-version-from-git.sh)
fi

DIST_VERSION=$("$DIR"/normalize-version.sh "$DIST_VERSION")
VERSION=$DIST_VERSION yarn build
echo "$DIST_VERSION" > /src/webapp/version
