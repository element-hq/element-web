#!/bin/bash

set -ev

handle_error() {
    EXIT_CODE=$?
    exit $EXIT_CODE
}

trap 'handle_error' ERR

echo "--- Building Element"
scripts/ci/layered.sh
cd element-web
element_web_dir=`pwd`
CI_PACKAGE=true yarn build
cd ..
# prepare end to end tests
pushd test/end-to-end-tests
ln -s $element_web_dir element/element-web
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true ./install.sh
# CHROME_PATH=$(which google-chrome-stable) ./run.sh
echo "--- Install synapse & other dependencies"
./install.sh
# install static webserver to server symlinked local copy of element
./element/install-webserver.sh
popd
