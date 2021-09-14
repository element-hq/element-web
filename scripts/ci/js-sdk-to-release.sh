#!/bin/sh

# This changes the js-sdk into 'release mode', that is:
# * The entry point for the library is the babel-compiled lib/index.js rather than src/index.ts
# * There's a 'typings' entry referencing the types output by tsc
# We do this so we can test that each PR still builds / type checks correctly when built
# against the released js-sdk, because if you do things like `import { User } from 'matrix-js-sdk';`
# rather than `import { User } from 'matrix-js-sdk/src/models/user';` it will work fine with the
# js-sdk in development mode but then break at release time.
# We can't use the last release of the js-sdk though: it might not be up to date enough.

cd node_modules/matrix-js-sdk
for i in main typings
do
    lib_value=$(jq -r ".matrix_lib_$i" package.json)
    if [ "$lib_value" != "null" ]; then
        jq ".$i = .matrix_lib_$i" package.json > package.json.new && mv package.json.new package.json
    fi
done
yarn run build:compile
yarn run build:types
