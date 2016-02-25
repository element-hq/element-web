#!/bin/bash

set -e

export NVM_DIR="/home/jenkins/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 4

set -x

# install the versions of js-sdk and react-sdk provided to us by jenkins
npm install ./node_modules/matrix-js-sdk-*.tgz
npm install ./node_modules/matrix-react-sdk-*.tgz

# install the other dependencies
npm install

# build our artifacts; dumps them in ./vector
npm run build

# gzip up ./vector
rm vector-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist

REACT_SHA=$(head -c 12 node_modules/matrix-react-sdk/version.txt)
JSSDK_SHA=$(head -c 12 node_modules/matrix-js-sdk/version.txt)
VECTOR_SHA=$(git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop
tar -zcvhf vector-$VECTOR_SHA-react-$REACT_SHA-js-$JSSDK_SHA.tar.gz vector #g[z]ip, [c]reate archive, [v]erbose, [f]ilename, [h]ard-dereference (do not archive symlinks)
