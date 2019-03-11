#!/bin/bash

set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 10

set -x

# install the other dependencies
yarn install

scripts/fetchdep.sh matrix-org matrix-js-sdk
rm -r node_modules/matrix-js-sdk || true
ln -s ../matrix-js-sdk node_modules/matrix-js-sdk
(cd matrix-js-sdk && yarn install)

# run the mocha tests
yarn test --no-colors

# run eslint
yarn lintall -f checkstyle -o eslint.xml || true

# re-run the linter, excluding any files known to have errors or warnings.
yarn lintwithexclusions

# delete the old tarball, if it exists
rm -f matrix-react-sdk-*.tgz

# build our tarball
yarn pack
