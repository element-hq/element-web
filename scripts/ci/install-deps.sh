#!/bin/bash

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
popd

yarn link matrix-js-sdk
yarn link matrix-analytics-events
yarn install --pure-lockfile $@
