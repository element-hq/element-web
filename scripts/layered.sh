#!/usr/bin/env bash

set -ex

# Creates a layered environment with the full repo for the app and SDKs cloned
# and linked. This gives an element-web dev environment ready to build with
# matching branches of react-sdk's dependencies so that changes can be tested
# in element-web.

# Note that this style is different from the recommended developer setup: this
# file nests js-sdk inside element-web, while the local
# development setup places them all at the same level. We are nesting them here
# because some CI systems do not allow moving to a directory above the checkout
# for the primary repo (element-web in this case).

# Install dependencies
yarn install --frozen-lockfile

# Pass appropriate repo to fetchdep.sh
export PR_ORG=element-hq
export PR_REPO=element-web

# Set up the js-sdk first
scripts/fetchdep.sh matrix-org matrix-js-sdk develop
pushd matrix-js-sdk
[ -n "$JS_SDK_GITHUB_BASE_REF" ] && git fetch --depth 1 origin $JS_SDK_GITHUB_BASE_REF && git checkout $JS_SDK_GITHUB_BASE_REF
yarn link
yarn install --frozen-lockfile
popd

# Also set up matrix-analytics-events for branch with matching name
scripts/fetchdep.sh matrix-org matrix-analytics-events
# We don't pass a default branch so cloning may fail when we are not in a PR
# This is expected as this project does not share a release cycle but we still branch match it
if [ -d matrix-analytics-events ]; then
    pushd matrix-analytics-events
    yarn link
    yarn install --frozen-lockfile
    yarn build:ts
    popd
fi

# Link the layers into element-web
yarn link matrix-js-sdk
[ -d matrix-analytics-events ] && yarn link @matrix-org/analytics-events
yarn install --frozen-lockfile $@
