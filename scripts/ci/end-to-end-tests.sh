#!/bin/bash
#
# script which is run by the CI build (after `yarn test`).
#
# clones riot-web develop and runs the tests against our version of react-sdk.

set -ev

handle_error() {
    EXIT_CODE=$?
    exit $EXIT_CODE
}

trap 'handle_error' ERR

echo "--- Building Element"
scripts/ci/layered-riot-web.sh
cd ../riot-web
riot_web_dir=`pwd`
CI_PACKAGE=true yarn build
cd ../matrix-react-sdk
# run end to end tests
pushd test/end-to-end-tests
ln -s $riot_web_dir riot/riot-web
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true ./install.sh
# CHROME_PATH=$(which google-chrome-stable) ./run.sh
echo "--- Install synapse & other dependencies"
./install.sh
# install static webserver to server symlinked local copy of riot
./riot/install-webserver.sh
rm -r logs || true
mkdir logs
echo "+++ Running end-to-end tests"
TESTS_STARTED=1
./run.sh --no-sandbox --log-directory logs/
popd
