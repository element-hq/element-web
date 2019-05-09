#!/bin/bash
#
# script which is run by the CI build (after `yarn test`).
#
# clones riot-web develop and runs the tests against our version of react-sdk.

set -ev

upload_logs() {
    echo "--- Uploading logs"
    buildkite-agent artifact upload "logs/**/*;synapse/installations/consent/homeserver.log"
}

handle_error() {
    EXIT_CODE=$?
    if [ $TESTS_STARTED -eq 1 ]; then
        upload_logs
    fi
    exit $EXIT_CODE
}

trap 'handle_error' ERR

RIOT_WEB_DIR=riot-web
REACT_SDK_DIR=`pwd`


echo "--- Building Riot"
scripts/ci/build.sh
# run end to end tests
echo "--- Fetching end-to-end tests from master"
scripts/fetchdep.sh matrix-org matrix-react-end-to-end-tests master
pushd matrix-react-end-to-end-tests
ln -s $REACT_SDK_DIR/$RIOT_WEB_DIR riot/riot-web
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true ./install.sh
# CHROME_PATH=$(which google-chrome-stable) ./run.sh
echo "--- Install synapse & other dependencies"
./install.sh
mkdir logs
echo "+++ Running end-to-end tests"
TESTS_STARTED=1
./run.sh --no-sandbox --log-directory logs/
popd
