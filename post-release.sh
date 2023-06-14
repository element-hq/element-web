#!/bin/bash
#
# Script to perform a post-release steps of matrix-js-sdk.
#
# Requires:
#   jq; install from your distribution's package manager (https://stedolan.github.io/jq/)

set -e

jq --version > /dev/null || (echo "jq is required: please install it"; kill $$)

if [ "$(git branch -lr | grep origin/develop -c)" -ge 1 ]; then
    # When merging to develop, we need revert the `main` and `typings` fields if we adjusted them previously.
    for i in main typings browser
    do
        # If a `lib` prefixed value is present, it means we adjusted the field
        # earlier at publish time, so we should revert it now.
        if [ "$(jq -r ".matrix_lib_$i" package.json)" != "null" ]; then
            # If there's a `src` prefixed value, use that, otherwise delete.
            # This is used to delete the `typings` field and reset `main` back
            # to the TypeScript source.
            src_value=$(jq -r ".matrix_src_$i" package.json)
            if [ "$src_value" != "null" ]; then
                jq ".$i = .matrix_src_$i" package.json > package.json.new && mv package.json.new package.json && yarn prettier --write package.json
            else
                jq "del(.$i)" package.json > package.json.new && mv package.json.new package.json && yarn prettier --write package.json
            fi
        fi
    done

    if [ -n "$(git ls-files --modified package.json)" ]; then
        echo "Committing develop package.json"
        git commit package.json -m "Resetting package fields for development"
    fi

    git push origin develop
fi
