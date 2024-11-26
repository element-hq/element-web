#!/bin/bash

set -ex

tmpdir=$(mktemp -d)
scriptdir=$(dirname "$(realpath "$0")")

git clone --depth 1 https://github.com/win98se/twemoji-colr.git "$tmpdir"
pushd "$tmpdir"

# Install dependencies
npm i

# Build fonts
make
woff2_compress "build/Twemoji Mozilla.ttf"

# Move into the right place
mv "build/Twemoji Mozilla.woff2" "$scriptdir/../res/fonts/Twemoji_Mozilla/TwemojiMozilla-colr.woff2"

# cleanup
popd
rm -Rf "$tmpdir"
