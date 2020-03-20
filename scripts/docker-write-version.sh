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
if [[ $BRANCH != 'HEAD' && $BRANCH != 'heads/v*' ]]
then
    REACT_SHA=$(cd node_modules/matrix-react-sdk; git rev-parse --short=12 HEAD)
    JSSDK_SHA=$(cd node_modules/matrix-js-sdk; git rev-parse --short=12 HEAD)
    VECTOR_SHA=$(git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop
    DIST_VERSION=$VECTOR_SHA-react-$REACT_SHA-js-$JSSDK_SHA
fi

echo $DIST_VERSION > /src/webapp/version
