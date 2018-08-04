#!/bin/bash
#
# script which is run by the travis build (after `npm run test`).
#
# clones riot-web develop and runs the tests against our version of react-sdk.

set -ev

RIOT_WEB_DIR=riot-web
REACT_SDK_DIR=`pwd`

scripts/fetchdep.sh vector-im riot-web
pushd "$RIOT_WEB_DIR"

mkdir node_modules
npm install

# use the version of js-sdk we just used in the react-sdk tests
rm -r node_modules/matrix-js-sdk
ln -s "$REACT_SDK_DIR/node_modules/matrix-js-sdk" node_modules/matrix-js-sdk

# ... and, of course, the version of react-sdk we just built
rm -r node_modules/matrix-react-sdk
ln -s "$REACT_SDK_DIR" node_modules/matrix-react-sdk

npm run build
npm run test
popd

# run end to end tests
git clone https://github.com/matrix-org/matrix-react-end-to-end-tests.git --branch master
pushd matrix-react-end-to-end-tests
ln -s $REACT_SDK_DIR/$RIOT_WEB_DIR riot/riot-web
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true ./install.sh
# CHROME_PATH=$(which google-chrome-stable) ./run.sh
./install.sh
./run.sh
popd
