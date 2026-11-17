#!/usr/bin/env bash

set -ex

# Automatically link to develop if we're building develop, but only if the caller
# hasn't asked us to build something else
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ $USE_CUSTOM_SDKS == false ]] && [[ $BRANCH == 'develop' ]]
then
    echo "using develop dependency for js-sdk"
    USE_CUSTOM_SDKS=true
    JS_SDK_BRANCH='develop'
fi

if [[ $USE_CUSTOM_SDKS == false ]]
then
    echo "skipping js-sdk install: USE_CUSTOM_SDKS is false"
    exit 0
fi

# Follows process from layered.sh - see that for reasoning as to why we do this rather than just `pnpm link`
echo "Installing js-sdk"
git clone --depth 1 --branch $JS_SDK_BRANCH "$JS_SDK_REPO" matrix-js-sdk
pnpm -C matrix-js-sdk install --frozen-lockfile --ignore-scripts

echo "Setting up element-web with js-sdk package"
pnpm -C matrix-js-sdk pack --out matrix-js-sdk.tgz
pnpm -C apps/web install $(pwd)/matrix-js-sdk/matrix-js-sdk.tgz
