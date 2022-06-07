#!/bin/bash

# This installs other Matrix dependencies that are often
# developed in parallel with react-sdk, using fetchdep.sh
# for branch matching.
# This will set up a working react-sdk environment, so is
# used for running react-sdk standalone tests. To set up a
# build of element-web, use layered.sh

set -ex

scripts/fetchdep.sh matrix-org matrix-js-sdk
pushd matrix-js-sdk
yarn link
yarn install --pure-lockfile $@
popd

scripts/fetchdep.sh matrix-org matrix-analytics-events main
pushd matrix-analytics-events
yarn link
yarn install --pure-lockfile $@
yarn build:ts
popd

yarn link matrix-js-sdk
yarn link @matrix-org/analytics-events
yarn install --pure-lockfile $@
