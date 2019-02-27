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

RIOT_LANGUAGES_FILE="../riot-web/webapp/i18n/languages.json" npm run build
popd
