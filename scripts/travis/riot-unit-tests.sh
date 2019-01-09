#!/bin/bash
#
# script which is run by the travis build (after `npm run test`).
#
# clones riot-web develop and runs the tests against our version of react-sdk.

set -ev

RIOT_WEB_DIR=riot-web

scripts/travis/build.sh
pushd "$RIOT_WEB_DIR"
npm run test
popd
