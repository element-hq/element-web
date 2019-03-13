#!/bin/bash

set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 10

set -x

# check out corresponding branches of dependencies.
# clone the deps with depth 1: we know we will only ever need that one commit.
`dirname $0`/fetch-develop.deps.sh --depth 1

yarn install

# run the mocha tests
yarn test

# run eslint
yarn lintall -- -f checkstyle -o eslint.xml || true

rm dist/riot-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist

# Since the deps are fetched from git, we can rev-parse
REACT_SHA=$(cd node_modules/matrix-react-sdk; git rev-parse --short=12 HEAD)
JSSDK_SHA=$(cd node_modules/matrix-js-sdk; git rev-parse --short=12 HEAD)

VECTOR_SHA=$(git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop

DIST_VERSION=$VECTOR_SHA-react-$REACT_SHA-js-$JSSDK_SHA scripts/package.sh -d
