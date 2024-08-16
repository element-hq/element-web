#!/bin/bash

# This installs other Matrix dependencies that are often
# developed in parallel with react-sdk, using fetchdep.sh
# for branch matching.
# This will set up a working react-sdk environment, so is
# used for running react-sdk standalone tests. To set up a
# build of element-web, use layered.sh

set -ex

scripts/fetchdep.sh verji matrix-js-sdk verji-develop # VERJI HARDCODE PARAMS
pushd matrix-js-sdk
[ -n "$JS_SDK_GITHUB_BASE_REF" ] && git fetch --depth 1 origin $JS_SDK_GITHUB_BASE_REF && git checkout $JS_SDK_GITHUB_BASE_REF
yarn link
yarn install --frozen-lockfile $@
popd

#VERJI COMMENT remove matrix-analytics-event
#scripts/fetchdep.sh matrix-org matrix-analytics-events
# We don't pass a default branch so cloning may fail when we are not in a PR
# This is expected as this project does not share a release cycle but we still branch match it
#if [ -d matrix-analytics-events ]; then
#    pushd matrix-analytics-events
#    yarn link
#    yarn install --frozen-lockfile $@
#    yarn build:ts
#    popd
#fi
# END VERJI COMMENT

# VERJI ADD custom module-api
scripts/fetchdep.sh verji matrix-react-sdk-module-api verji-main # VERJI HARDCODE PARAMS
pushd matrix-js-sdk
[ -n "$JS_SDK_GITHUB_BASE_REF" ] && git fetch --depth 1 origin $JS_SDK_GITHUB_BASE_REF && git checkout $JS_SDK_GITHUB_BASE_REF
yarn link
yarn install --frozen-lockfile $@
popd

yarn link @matrix-org/react-sdk-module-api
# VERJI END - custom module-api
yarn link matrix-js-sdk
[ -d matrix-analytics-events ] && yarn link @matrix-org/analytics-events
yarn install --frozen-lockfile $@
