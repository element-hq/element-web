#!/bin/bash

set -ex

BRANCH=$(git rev-parse --abbrev-ref HEAD)
DIST_VERSION=$(git describe --abbrev=0 --tags)

DIR=$(dirname "$0")

# If the branch comes out as HEAD then we're probably checked out to a tag, so if the thing is *not*
# coming out as HEAD then we're on a branch. When we're on a branch, we want to resolve ourselves to
# a few SHAs rather than a version.
# Docker Hub doesn't always check out the tag and sometimes checks out the branch, so we should look
# for an appropriately tagged branch as well (heads/v1.2.3).
if [[ $USE_CUSTOM_SDKS == false ]] && [[ $BRANCH != 'master' ]]
then
    DIST_VERSION=$("$DIR"/get-version-from-git.sh)
fi

DIST_VERSION=$("$DIR"/normalize-version.sh "$DIST_VERSION")
VERSION=$DIST_VERSION yarn build
echo "$DIST_VERSION" > /src/webapp/version
