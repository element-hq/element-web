#!/usr/bin/env bash

set -x
declare -A archMap=(["amd64"]="x64" ["arm64"]="arm64")
ARCH="${archMap["$TARGETARCH"]}"
# The .node-version file generally doesn't have the 'v' (renovate does not put the 'v' and will
# strip it on upgrade if it's there) but the 'v' is also widely supported so we probably ought
# to just work either way.
NODE_VERSION=$(cat /.node-version | sed -e 's/^v//')
curl --proto "=https" -L "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$TARGETOS-$ARCH.tar.gz" | tar xz -C /usr/local --strip-components=1 && \
  unlink /usr/local/CHANGELOG.md && unlink /usr/local/LICENSE && unlink /usr/local/README.md
