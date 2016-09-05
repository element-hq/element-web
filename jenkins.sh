#!/bin/bash

set -e

export NVM_DIR="/home/jenkins/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 6

set -x

npm install

# apparently npm 3.10.3 on node 6.4.0 doesn't upgrade #develop target with npm install unless explicitly asked.
npm install matrix-react-sdk matrix-js-sdk

# install olm
npm install ./olm/olm-*.tgz

# we may be using a dev branch of react-sdk, in which case we need to build it
(cd node_modules/matrix-react-sdk && npm run build)

# run the mocha tests
npm run test

# build our artifacts; dumps them in ./vector
npm run build:dev

# gzip up ./vector
rm vector-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist

 # node_modules deps from 'npm install' don't have a .git dir so can't
 # rev-parse; but they do set the commit in package.json under 'gitHead' which
 # we're grabbing here.
REACT_SHA=$(grep 'gitHead' node_modules/matrix-react-sdk/package.json | cut -d \" -f 4 | head -c 12)
JSSDK_SHA=$(grep 'gitHead' node_modules/matrix-js-sdk/package.json | cut -d \" -f 4 | head -c 12)

VECTOR_SHA=$(git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop

tar -zcvhf vector-$VECTOR_SHA-react-$REACT_SHA-js-$JSSDK_SHA.tar.gz vector #g[z]ip, [c]reate archive, [v]erbose, [f]ilename, [h]ard-dereference (do not archive symlinks)
