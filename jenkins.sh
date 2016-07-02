#!/bin/bash

set -e

export KARMAFLAGS="--no-colors"
export NVM_DIR="/home/jenkins/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 4

set -x

# install the other dependencies
npm install

# run the mocha tests
npm run test

# run eslint
npm run lint -- -f checkstyle -o eslint.xml || true

# delete the old tarball, if it exists
rm -f matrix-react-sdk-*.tgz

# build our tarball
npm pack
