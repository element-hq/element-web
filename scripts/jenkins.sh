#!/bin/bash

set -e

export NVM_DIR="/home/jenkins/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 6

set -x

npm install

# apparently npm 3.10.3 on node 6.4.0 doesn't upgrade #develop target with npm install unless explicitly asked.
npm install matrix-react-sdk matrix-js-sdk olm

# install olm. A naive 'npm i ./olm/olm-*.tgz' fails because it uses the url
# from our package.json (or even matrix-js-sdk's) in preference.
#
# disabled for now, to avoid the annoying scenario of a release doing something
# different to /develop. Instead, add it to the 'npm install' list above.
# -- rav 2016/02/03
#tar -C olm -xz < olm/olm-*.tgz
#rm -r node_modules/olm
#cp -r olm/package node_modules/olm


# we may be using dev branches of js-sdk and react-sdk, in which case we need to build them
(cd node_modules/matrix-js-sdk && npm install)
(cd node_modules/matrix-react-sdk && npm install)

# run the mocha tests
npm run test

# run eslint
npm run lintall -- -f checkstyle -o eslint.xml || true

rm dist/vector-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist

 # node_modules deps from 'npm install' don't have a .git dir so can't
 # rev-parse; but they do set the commit in package.json under 'gitHead' which
 # we're grabbing here.
REACT_SHA=$(grep 'gitHead' node_modules/matrix-react-sdk/package.json | cut -d \" -f 4 | head -c 12)
JSSDK_SHA=$(grep 'gitHead' node_modules/matrix-js-sdk/package.json | cut -d \" -f 4 | head -c 12)

VECTOR_SHA=$(git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop

DIST_VERSION=$VECTOR_SHA-react-$REACT_SHA-js-$JSSDK_SHA scripts/package.sh -d
