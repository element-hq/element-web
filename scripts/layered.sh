#!/usr/bin/env bash

set -ex

# Creates a layered environment with the full repo for the app and SDKs cloned
# and linked. This gives an element-web dev environment ready to build with
# matching branches of matrix-js-sdk so that changes can be tested
# in element-web.

# Note that this style is different from the recommended developer setup: this
# file nests js-sdk inside element-web, while the local
# development setup places them all at the same level. We are nesting them here
# because some CI systems do not allow moving to a directory above the checkout
# for the primary repo (element-web in this case).

# Install dependencies
pnpm install --frozen-lockfile $@

# Pass appropriate repo to fetchdep.sh
export PR_ORG=element-hq
export PR_REPO=element-web

js_sdk_dep=$(jq -r '.dependencies["matrix-js-sdk"]' < $(pnpm -w root)/../apps/web/package.json)

# Set up the js-sdk (unless package.json pins a specific version)
if [ "$js_sdk_dep" = "github:matrix-org/matrix-js-sdk#develop" ]; then
    echo "layered.sh: Cloning matching branch of matrix-js-sdk"
    scripts/fetchdep.sh matrix-org matrix-js-sdk develop

    if [ -n "$JS_SDK_GITHUB_BASE_REF" ]; then
        echo "layered.sh: Switching js-sdk to $JS_SDK_GITHUB_BASE_REF"
        git -C matrix-js-sdk fetch --depth 1 origin $JS_SDK_GITHUB_BASE_REF
        git -C matrix-js-sdk -c advice.detachedHead=false checkout $JS_SDK_GITHUB_BASE_REF
    fi

    # Install matrix-js-sdk's build dependencies
    pnpm -C matrix-js-sdk install --frozen-lockfile --ignore-scripts

    # Rather than using `pnpm link` (or `pnpm install ./matrix-js-sdk`, which
    # does the same thing), we build the js-sdk into a tarball and then install
    # that.
    #
    # This is preferable because it better reflects the behaviour when doing a clean
    # `pnpm install` in a checkout of element-web: for example, js-sdk dependencies may
    # be hoisted and shared with element-web, and there is no tsconfig.json.
    pnpm -C matrix-js-sdk pack --out matrix-js-sdk.tgz
    pnpm -C apps/web install $(pwd)/matrix-js-sdk/matrix-js-sdk.tgz
else
    echo "layered.sh: Skipping matrix-js-sdk fetch and install as package.json pins $js_sdk_dep"
fi
