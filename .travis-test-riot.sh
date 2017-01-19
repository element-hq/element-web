#!/bin/bash
#
# script which is run by the travis build (after `npm run test`).
#
# clones riot-web develop and runs the tests against our version of react-sdk.

set -ev

git clone --depth=1 --branch develop https://github.com/vector-im/riot-web.git riot-web
cd riot-web
mkdir node_modules
ln -s ../.. node_modules/matrix-react-sdk
npm install
(cd node_modules/matrix-js-sdk && npm install)
npm run test
