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
scripts/fetchdep.sh verji matrix-js-sdk verji-develop
pushd matrix-js-sdk
[ -n "$JS_SDK_GITHUB_BASE_REF" ] && git fetch --depth 1 origin $JS_SDK_GITHUB_BASE_REF && git checkout $JS_SDK_GITHUB_BASE_REF
yarn link
yarn install --frozen-lockfile
popd

# VERJI COMMENT OUT
# Also set up matrix-analytics-events for branch with matching name
#scripts/fetchdep.sh matrix-org matrix-analytics-events
# We don't pass a default branch so cloning may fail when we are not in a PR
# This is expected as this project does not share a release cycle but we still branch match it
# if [ -d matrix-analytics-events ]; then
#     pushd matrix-analytics-events
#     yarn link
#     yarn install --frozen-lockfile
#     yarn build:ts
#     popd
# fi

# Now set up the react-sdk
yarn link matrix-js-sdk
[ -d matrix-analytics-events ] && yarn link @matrix-org/analytics-events
yarn link
yarn install --frozen-lockfile

# VERJI ADD custom module-api
scripts/fetchdep.sh verji matrix-react-sdk-module-api verji-main # VERJI HARDCODE PARAMS.
pushd matrix-react-sdk-module-api
yarn link
yarn install ## TRY WITHOUT FROZEN --frozen-lockfile $@
yarn build
popd

# Finally, set up element-web
scripts/fetchdep.sh verji element-web verji-develop
pushd element-web
[ -n "$ELEMENT_WEB_GITHUB_BASE_REF" ] && git fetch --depth 1 origin $ELEMENT_WEB_GITHUB_BASE_REF && git checkout $ELEMENT_WEB_GITHUB_BASE_REF
yarn link matrix-js-sdk
yarn link matrix-react-sdk
yarn link @matrix-org/react-sdk-module-api
yarn install --frozen-lockfile
yarn build:res
popd
