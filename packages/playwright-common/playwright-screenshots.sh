#!/bin/bash
#
# Wrapper script for playwright, to be used when updating screenshots. It is installed as `node_modules/.bin/playwright-screenshots`.
#
# Starts playwright-server in a docker container, and then runs the rest of the
# commandline with the `PW_TEST_CONNECT_WS_ENDPOINT` environment variable set
# to the location of the playwright server.
#
# For this to be useful, your playwright config should contain:
#
# ```
# {
#   use: {
#     connectOptions: process.env.PW_TEST_CONNECT_WS_ENDPOINT ?
#       { wsEndpoint: process.env.PW_TEST_CONNECT_WS_ENDPOINT,
#         exposeNetwork: "<loopback>" }
#       : undefined,
#   },
#   snapshotPathTemplate: `{snapshotDir}/{testFilePath}/{arg}-${process.env.PW_TEST_CONNECT_WS_ENDPOINT ? "linux" : "{platform}"}{ext}`,
# }
# ```
#
# Usage: playwright-screenshots playwright test --update-snapshots --grep @screenshot ...
#
set -e

if [ $# -lt 1 -o "$1" = '-h' ]; then
    echo >&2 "Usage: playwright-screenshots playwright test --update-snapshots --grep @screenshot ..."
    exit 1
fi

# Handle symlinks here as we tend to be executed as an npm binary
SCRIPT_PATH=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")

function build_image() {
    local IMAGE_NAME="$1"

    echo "playwright-screenshots: Building $IMAGE_NAME image in $SCRIPT_DIR"
    docker build -t "$IMAGE_NAME" --build-arg "PLAYWRIGHT_VERSION=${IMAGE_NAME#*:}" "$SCRIPT_DIR"
}

WS_PORT=3000

# Check the playwright version
PW_VERSION=$(pnpm --silent -- playwright --version | awk '{print $2}')
IMAGE_NAME="ghcr.io/element-hq/element-web/playwright-server:$PW_VERSION"

# If the image exists in the repository, pull it; otherwise, build it.
#
# (This explicit test gives the user clearer progress info than just
# `docker pull 2>/dev/null || build_image`.)
if docker manifest inspect "$IMAGE_NAME" &>/dev/null; then
    docker pull "$IMAGE_NAME"
else
    build_image "$IMAGE_NAME"
fi

# Start the playwright-server in docker
CONTAINER=$(docker run --network=host -v /tmp:/tmp --rm -d -e PORT="$WS_PORT" "$IMAGE_NAME")
# Set up an exit trap to clean up the docker container
clean_up() {
    ARG=$?
    echo "playwright-screenshots: Stopping playwright-server"
    docker stop "$CONTAINER" > /dev/null
    exit $ARG
}
trap clean_up EXIT

# Wait for playwright-server to be ready
echo "playwright-screenshots: Waiting for playwright-server"
pnpm --dir "$SCRIPT_DIR" exec wait-on "tcp:$WS_PORT"

# Playwright seems to overwrite the last line from the console, so add an
# extra newline to make sure this doesn't get lost.
echo -e "playwright-screenshots: Running '$@'\n"

# Run the test we were given, setting PW_TEST_CONNECT_WS_ENDPOINT accordingly
PW_TEST_CONNECT_WS_ENDPOINT="http://localhost:$WS_PORT" "$@"
