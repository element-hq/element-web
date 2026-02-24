#!/bin/bash

set -e

function build_image() {
    local IMAGE_NAME="$1"
    # Handle symlinks here as we tend to be executed as an npm binary
    local SCRIPT_PATH=$(readlink -f "$0")
    local SCRIPT_DIR=$(dirname "$SCRIPT_PATH")

    echo "Building $IMAGE_NAME image in $SCRIPT_DIR"
    docker build -t "$IMAGE_NAME" --build-arg "PLAYWRIGHT_VERSION=${IMAGE_NAME#*:}" "$SCRIPT_DIR"
}

WS_PORT=3000

# Check the playwright version
PW_VERSION=$(pnpm --silent -- playwright --version | awk '{print $2}')
IMAGE_NAME="ghcr.io/element-hq/element-web/playwright-server:$PW_VERSION"

# Pull the image, failing that build the image
docker pull "$IMAGE_NAME" 2>/dev/null || build_image "$IMAGE_NAME"

# Start the playwright-server in docker
CONTAINER=$(docker run --network=host --rm -d -e PORT="$WS_PORT" "$IMAGE_NAME")
# Set up an exit trap to clean up the docker container
clean_up() {
    ARG=$?
    echo "Stopping playwright-server"
    docker stop "$CONTAINER" > /dev/null
    exit $ARG
}
trap clean_up EXIT

# Wait for playwright-server to be ready
echo "Waiting for playwright-server"
pnpm wait-on "tcp:$WS_PORT"

# Run the test we were given, setting PW_TEST_CONNECT_WS_ENDPOINT accordingly
echo "Running '$@'"
PW_TEST_CONNECT_WS_ENDPOINT="http://localhost:$WS_PORT" "$@"
