#!/bin/bash

set -e

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 10

set -x

scripts/fetchdep.sh matrix-org matrix-js-sdk

pushd matrix-js-sdk
yarn link
yarn install
popd

yarn link matrix-js-sdk

# install the other dependencies
yarn install

# run the mocha tests
yarn test --no-colors

# run eslint
yarn lintall -f checkstyle -o eslint.xml || true

# re-run the linter, excluding any files known to have errors or warnings.
yarn lintwithexclusions

# lint styles
yarn stylelint

# delete the old tarball, if it exists
rm -f matrix-react-sdk-*.tgz

# build our tarball
yarn pack
