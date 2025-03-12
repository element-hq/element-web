#!/bin/bash

# Handle symlinks here as we tend to be executed as an npm binary
SCRIPT_PATH=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")

IMAGE_NAME="element-web-playwright-common"
echo "Building $IMAGE_NAME image in $SCRIPT_DIR"

# Build image
PW_VERSION=$(
  yarn list \
    --pattern @playwright/test \
    --depth=0 \
    --json \
    --non-interactive \
    --no-progress | \
    jq -r '.data.trees[].name | split("@")[2]' \
  )
echo "with Playwright version $PW_VERSION"

docker build -t "$IMAGE_NAME" --build-arg "PLAYWRIGHT_VERSION=$PW_VERSION" "$SCRIPT_DIR"

RUN_ARGS=(
  --rm
  --network host
  # Pass BASE_URL and CI environment variables to the container
  -e BASE_URL
  -e CI
  # Bind mount the working directory into the container
  -v $(pwd):/work/
  # Bind mount the docker socket so we can run docker commands from the container
  -v /var/run/docker.sock:/var/run/docker.sock
  # Bind mount /tmp so we can store temporary files
  -v /tmp/:/tmp/
  -it
)

# Ensure we pass all symlinked node_modules to the container
pushd node_modules || exit > /dev/null
SYMLINKS=$(find . -maxdepth 2 -type l -not -path "./.bin/*")
popd || exit > /dev/null
for LINK in $SYMLINKS; do
  TARGET=$(readlink -f "node_modules/$LINK")
  if [ -d "$TARGET" ]; then
    echo "mounting linked package ${LINK:2} in container"
    RUN_ARGS+=( "-v" "$TARGET:/work/node_modules/${LINK:2}" )
  fi
done

DEFAULT_ARGS=(--grep @screenshot)

docker run "${RUN_ARGS[@]}" "$IMAGE_NAME" "${DEFAULT_ARGS[@]}" "$@"