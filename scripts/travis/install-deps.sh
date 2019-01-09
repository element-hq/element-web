#!/bin/sh

set -ex
npm install
scripts/fetchdep.sh matrix-org matrix-js-sdk
rm -r node_modules/matrix-js-sdk || true
ln -s ../matrix-js-sdk node_modules/matrix-js-sdk

cd matrix-js-sdk
npm install
cd ..
