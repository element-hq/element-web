#!/bin/bash

set -e

export KARMAFLAGS="--no-colors"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 4

set -x

# install the other dependencies
npm install

# we may be using a dev branch of js-sdk in which case we need to build it
(cd node_modules/matrix-js-sdk && npm install)

# run the mocha tests
npm run test

# run eslint
npm run lintall -- -f checkstyle -o eslint.xml || true

# delete the old tarball, if it exists
rm -f matrix-react-sdk-*.tgz

# build our tarball
npm pack
