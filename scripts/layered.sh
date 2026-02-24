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
pnpm install --frozen-lockfile

# Pass appropriate repo to fetchdep.sh
export PR_ORG=element-hq
export PR_REPO=element-web

js_sdk_dep=`jq -r '.dependencies["matrix-js-sdk"]' < package.json`
analytics_events_dep=`jq -r '.dependencies["@matrix-org/analytics-events"]' < package.json`

# Set up the js-sdk first (unless package.json pins a specific version)
if [ "$js_sdk_dep" = "github:matrix-org/matrix-js-sdk#develop" ]; then
    scripts/fetchdep.sh matrix-org matrix-js-sdk develop
    pushd matrix-js-sdk
    [ -n "$JS_SDK_GITHUB_BASE_REF" ] && git fetch --depth 1 origin $JS_SDK_GITHUB_BASE_REF && git checkout $JS_SDK_GITHUB_BASE_REF
    pnpm link
    pnpm install --frozen-lockfile
    popd
else
    echo "Skipping matrix-js-sdk fetch and link as package.json pins $js_sdk_dep"
fi

# Also set up matrix-analytics-events for branch with matching name
if [ "$analytics_events_dep" = "github:matrix-org/matrix-analytics-events#develop" ]; then
    scripts/fetchdep.sh matrix-org matrix-analytics-events
    # We don't pass a default branch so cloning may fail when we are not in a PR
    # This is expected as this project does not share a release cycle but we still branch match it
    if [ -d matrix-analytics-events ]; then
        pushd matrix-analytics-events
        pnpm link
        pnpm install --frozen-lockfile
        pnpm build:ts
        popd
    fi
else
    echo "Skipping matrix-analytics-events fetch and link as package.json pins $analytics_events_dep"
fi

# Link the layers into element-web
if [ "$js_sdk_dep" = "github:matrix-org/matrix-js-sdk#develop" ]; then
    pnpm link matrix-js-sdk
fi
if [ "$analytics_events_dep" = "github:matrix-org/matrix-analytics-events#develop" ] && [ -d matrix-analytics-events ]; then
    pnpm link @matrix-org/analytics-events
fi
pnpm install --frozen-lockfile $@
