#!/bin/bash

# Creates an environment similar to one that element-web would expect for
# development. This means going one directory up (and assuming we're in
# a directory like /workdir/matrix-react-sdk) and putting element-web and
# the js-sdk there.

cd ../  # Assume we're at something like /workdir/matrix-react-sdk

# Set up the js-sdk first
matrix-react-sdk/scripts/fetchdep.sh matrix-org matrix-js-sdk
pushd matrix-js-sdk
yarn link
yarn install
popd

# Now set up the react-sdk
pushd matrix-react-sdk
yarn link matrix-js-sdk
yarn link
yarn install
popd

# Finally, set up element-web
matrix-react-sdk/scripts/fetchdep.sh vector-im element-web
pushd element-web
yarn link matrix-js-sdk
yarn link matrix-react-sdk
yarn install
yarn build:res
popd
