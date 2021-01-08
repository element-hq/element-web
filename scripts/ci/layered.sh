#!/bin/bash

# Creates a layered environment with the full repo for the app and SDKs cloned
# and linked.

# Note that this style is different from the recommended developer setup: this
# file nests js-sdk and element-web inside react-sdk, while the local
# development setup places them all at the same level. We are nesting them here
# because some CI systems do not allow moving to a directory above the checkout
# for the primary repo (react-sdk in this case).

# Set up the js-sdk first
scripts/fetchdep.sh matrix-org matrix-js-sdk
pushd matrix-js-sdk
yarn link
yarn install
popd

# Now set up the react-sdk
yarn link matrix-js-sdk
yarn link
yarn install
yarn reskindex

# Finally, set up element-web
scripts/fetchdep.sh vector-im element-web
pushd element-web
yarn link matrix-js-sdk
yarn link matrix-react-sdk
yarn install
yarn build:res
popd
