#!/bin/bash

set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 10

set -x

npm install

# apparently npm 3.10.3 on node 6.4.0 doesn't upgrade #develop target with npm install unless explicitly asked.
npm install olm

# check out corresponding branches of dependencies.
#
# clone the deps with depth 1: we know we will only ever need that one
# commit.
# We need to do this after npm install otherwise modern node versions
# just reset it back.
`dirname $0`/fetch-develop.deps.sh --depth 1

# install olm. A naive 'npm i ./olm/olm-*.tgz' fails because it uses the url
# from our package.json (or even matrix-js-sdk's) in preference.
#
# disabled for now, to avoid the annoying scenario of a release doing something
# different to /develop. Instead, add it to the 'npm install' list above.
# -- rav 2016/02/03
#tar -C olm -xz < olm/olm-*.tgz
#rm -r node_modules/olm
#cp -r olm/package node_modules/olm

# run the mocha tests
npm run test

# run eslint
npm run lintall -- -f checkstyle -o eslint.xml || true

rm dist/riot-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist

# Since the deps are fetched from git, we can rev-parse
REACT_SHA=$(cd node_modules/matrix-react-sdk; git rev-parse --short=12 HEAD)
JSSDK_SHA=$(cd node_modules/matrix-js-sdk; git rev-parse --short=12 HEAD)

VECTOR_SHA=$(git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop

DIST_VERSION=$VECTOR_SHA-react-$REACT_SHA-js-$JSSDK_SHA scripts/package.sh -d
