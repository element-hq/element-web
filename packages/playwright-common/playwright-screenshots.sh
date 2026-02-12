#!/bin/bash

set -e

# Handle symlinks here as we tend to be executed as an npm binary
SCRIPT_PATH=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")

IMAGE_NAME="element-web-playwright-common"

echo "Building $IMAGE_NAME image in $SCRIPT_DIR"

# Check the playwright version
PM=$(cat package.json | jq -r '.packageManager')
if [[ $PM == "pnpm@"* ]]; then
    PW_VERSION=$(pnpm list @playwright/test --depth=0 --json | jq -r '.[].devDependencies["@playwright/test"].version')
else
    PW_VERSION=$(yarn list --pattern @playwright/test --depth=0 --json --non-interactive --no-progress | jq -r '.data.trees[].name | split("@") | last')
fi
echo "with Playwright version $PW_VERSION"

# Build image
docker build -t "$IMAGE_NAME:$PW_VERSION" --build-arg "PLAYWRIGHT_VERSION=$PW_VERSION" "$SCRIPT_DIR"

clean_up() {
    ARG=$?
    docker stop "$CONTAINER" > /dev/null
    exit $ARG
}
CONTAINER=$(docker run --network=host --rm -d "$IMAGE_NAME:$PW_VERSION")
trap clean_up EXIT

echo "Waiting for playwright-server"
pnpm wait-on tcp:3000

echo "Running '$@'"
PW_TEST_CONNECT_WS_ENDPOINT="http://localhost:3000" "$@"
