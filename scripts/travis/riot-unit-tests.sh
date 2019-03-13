#!/bin/bash
#
# script which is run by the travis build (after `yarn test`).
#
# clones riot-web develop and runs the tests against our version of react-sdk.

set -ev

RIOT_WEB_DIR=riot-web

scripts/travis/build.sh
pushd "$RIOT_WEB_DIR"
yarn test
popd
