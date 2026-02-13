#!/bin/bash

set -e

# Handle symlinks here as we tend to be executed as an npm binary
SCRIPT_PATH=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")

IMAGE_NAME="element-web-playwright-server"
WS_PORT=3000

# Check the playwright version
PW_VERSION=$(npm exec --silent -- playwright --version | gcut -d" " -f2)
echo "Building $IMAGE_NAME:$PW_VERSION image in $SCRIPT_DIR"

# Build the image
docker build -t "$IMAGE_NAME" --build-arg "PLAYWRIGHT_VERSION=$PW_VERSION" "$SCRIPT_DIR"

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
