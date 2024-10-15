#!/usr/bin/env bash

set -ex

# Automatically link to develop if we're building develop, but only if the caller
# hasn't asked us to build something else
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ $USE_CUSTOM_SDKS == false ]] && [[ $BRANCH == 'develop' ]]
then
    echo "using develop dependencies for react-sdk and js-sdk"
    USE_CUSTOM_SDKS=true
    JS_SDK_BRANCH='develop'
fi

if [[ $USE_CUSTOM_SDKS == false ]]
then
    echo "skipping js-sdk install: USE_CUSTOM_SDKS is false"
    exit 0
fi

echo "Linking js-sdk"
git clone --depth 1 --branch $JS_SDK_BRANCH "$JS_SDK_REPO" js-sdk
cd js-sdk
yarn link
yarn --network-timeout=100000 install
cd ../

echo "Setting up element-web with js-sdk package"
yarn link matrix-js-sdk
