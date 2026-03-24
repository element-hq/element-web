#!/bin/bash

set -e

cd $(dirname "$0")/..

IMAGE=${DOCKER_IMAGE_NAME:-"element-desktop-dockerbuild"}

docker inspect "$IMAGE" 2> /dev/null > /dev/null
if [ $? != 0 ]; then
    echo "Docker image $IMAGE not found. Have you run pnpm run docker:setup?"
    exit 1
fi

mkdir -p docker/node_modules docker/.hak docker/.gnupg

# Taken from https://www.electron.build/multi-platform-build#docker
# Pass through any vars prefixed with INDOCKER_, removing the prefix
docker run --rm -ti \
 --platform linux/amd64 \
 --env-file <(env | grep -E '^INDOCKER_' | sed -e 's/^INDOCKER_//') \
 --env ELECTRON_CACHE="/root/.cache/electron" \
 --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
 -v ${PWD}:/project \
 -v ${PWD}/docker/node_modules:/project/node_modules \
 -v ${PWD}/docker/.hak:/project/.hak \
 -v ${PWD}/docker/.gnupg:/root/.gnupg \
 -v ~/.cache/electron:/root/.cache/electron \
 -v ~/.cache/electron-builder:/root/.cache/electron-builder \
 "$IMAGE" "$@"
