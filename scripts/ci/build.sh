#!/bin/bash
#
# script which is run by the CI build (after `yarn test`).
#
# clones riot-web develop and runs the tests against our version of react-sdk.

set -ev

RIOT_WEB_DIR=riot-web
REACT_SDK_DIR=`pwd`

yarn link

scripts/fetchdep.sh vector-im riot-web

pushd "$RIOT_WEB_DIR"

yarn link matrix-js-sdk
yarn link matrix-react-sdk

yarn install

yarn build

popd
