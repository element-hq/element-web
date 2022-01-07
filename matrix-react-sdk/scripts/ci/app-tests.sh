#!/bin/bash
#
# script which is run by the CI build (after `yarn test`).
#
# clones element-web develop and runs the tests against our version of react-sdk.

set -ev

scripts/ci/layered.sh
cd element-web
yarn build:genfiles # so the tests can run. Faster version of `build`
yarn test
