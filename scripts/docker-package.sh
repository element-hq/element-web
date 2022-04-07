#!/bin/sh

set -ex

TAG=$(git describe --tags)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
DIST_VERSION=$TAG

# If the branch comes out as HEAD then we're probably checked out to a tag, so if the thing is *not*
# coming out as HEAD then we're on a branch. When we're on a branch, we want to resolve ourselves to
# a few SHAs rather than a version.
# Docker Hub doesn't always check out the tag and sometimes checks out the branch, so we should look
# for an appropriately tagged branch as well (heads/v1.2.3).
if [[ $BRANCH != HEAD && ! $BRANCH =~ heads/v.+ ]]
then
    DIST_VERSION=`$(dirname $0)/get-version-from-git.sh`
fi

DIST_VERSION=`$(dirname $0)/normalize-version.sh ${DIST_VERSION}`
VERSION=$DIST_VERSION yarn build
echo $DIST_VERSION > /src/webapp/version
