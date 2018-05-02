#!/bin/sh

set -ex

scripts/fetchdep.sh matrix-org matrix-js-sdk
rm -r node_modules/matrix-js-sdk || true
ln -s matrix-js-sdk node_modules/matrix-js-sdk

cd node_modules/matrix-js-sdk
npm install
cd ../..

npm run test
./.travis-test-riot.sh

# run the linter, but exclude any files known to have errors or warnings.
npm run lintwithexclusions
