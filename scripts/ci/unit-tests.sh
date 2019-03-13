#!/bin/bash
#
# script which is run by the CI build (after `yarn test`).
#
# clones riot-web develop and runs the tests against our version of react-sdk.

set -ev

scripts/ci/build.sh
CHROME_BIN='/usr/bin/google-chrome-stable' yarn test
