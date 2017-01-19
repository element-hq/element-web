#!/bin/bash
#
# script which is run by the travis build (after `npm run test`).
#
# clones riot-web develop and runs the tests against our version of react-sdk.

set -ev

RIOT_WEB_DIR=riot-web
REACT_SDK_DIR=`pwd`

git clone --depth=1 --branch develop https://github.com/vector-im/riot-web.git \
    "$RIOT_WEB_DIR"

cd "$RIOT_WEB_DIR"

mkdir node_modules
npm install

(cd node_modules/matrix-js-sdk && npm install)

rm -r node_modules/matrix-react-sdk
ln -s "$REACT_SDK_DIR" node_modules/matrix-react-sdk

npm run test
