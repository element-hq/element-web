#!/bin/bash

set -e

export NVM_DIR="/home/jenkins/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 4

set -x

# install the version of js-sdk provided to us by jenkins
npm install ./node_modules/matrix-js-sdk-*.tgz

# install the other dependencies
npm install

# build our tarball
npm pack
