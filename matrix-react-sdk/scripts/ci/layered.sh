#!/bin/bash

set -ex

# Creates a layered environment with the full repo for the app and SDKs cloned
# and linked. This gives an element-web dev environment ready to build with
# the current react-sdk branch and any matching branches of react-sdk's dependencies
# so that changes can be tested in element-web.

# Note that this style is different from the recommended developer setup: this
# file nests js-sdk and element-web inside react-sdk, while the local
# development setup places them all at the same level. We are nesting them here
# because some CI systems do not allow moving to a directory above the checkout
# for the primary repo (react-sdk in this case).

# Set up the js-sdk first
scripts/fetchdep.sh matrix-org matrix-js-sdk
pushd matrix-js-sdk
[ -n "$JS_SDK_GITHUB_BASE_REF" ] && git fetch --depth 1 origin $JS_SDK_GITHUB_BASE_REF && git checkout $JS_SDK_GITHUB_BASE_REF
yarn link
yarn install --frozen-lockfile
popd

# Also set up matrix-analytics-events so we get the latest from
# the main branch or a branch with matching name
scripts/fetchdep.sh matrix-org matrix-analytics-events main
pushd matrix-analytics-events
yarn link
yarn install --frozen-lockfile
yarn build:ts
popd

# Now set up the react-sdk
yarn link matrix-js-sdk
yarn link @matrix-org/analytics-events
yarn link
yarn install --frozen-lockfile

# Finally, set up element-web
scripts/fetchdep.sh vector-im element-web
pushd element-web
yarn link matrix-js-sdk
yarn link matrix-react-sdk
yarn install --frozen-lockfile
yarn build:res
popd
