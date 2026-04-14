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

js_sdk_dep=$(jq -r '.dependencies["matrix-js-sdk"]' < $(pnpm -w root)/../apps/web/package.json)

# Set up the js-sdk first (unless package.json pins a specific version)
if [ "$js_sdk_dep" = "github:matrix-org/matrix-js-sdk#develop" ]; then
    scripts/fetchdep.sh matrix-org matrix-js-sdk develop

    if [ -n "$JS_SDK_GITHUB_BASE_REF" ]; then
        git -C matrix-js-sdk fetch --depth 1 origin $JS_SDK_GITHUB_BASE_REF
        git -C matrix-js-sdk checkout $JS_SDK_GITHUB_BASE_REF
    fi

    # Link into into element-web
    pnpm link ./matrix-js-sdk
else
    echo "Skipping matrix-js-sdk fetch and link as package.json pins $js_sdk_dep"
fi

pnpm install --frozen-lockfile $@
