#!/usr/bin/env bash

set -ex

if [[ $USE_CUSTOM_SDKS == false ]]
then
    echo "skipping js-sdk install: USE_CUSTOM_SDKS is false"
    exit 0
fi

echo "Linking js-sdk"
git clone --depth 1 --branch $JS_SDK_BRANCH "$JS_SDK_REPO" js-sdk
cd js-sdk
pnpm link
pnpm install
cd ../

echo "Setting up element-web with js-sdk package"
pnpm link matrix-js-sdk
