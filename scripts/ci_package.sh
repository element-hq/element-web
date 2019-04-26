#!/bin/bash

# Runs package.sh setting the version to git hashes of the riot-web,
# react-sdk & js-sdk checkouts, for the case where these dependencies
# are git checkouts.

set -ex

rm dist/riot-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist

# Since the deps are fetched from git, we can rev-parse
REACT_SHA=$(cd node_modules/matrix-react-sdk; git rev-parse --short=12 HEAD)
JSSDK_SHA=$(cd node_modules/matrix-js-sdk; git rev-parse --short=12 HEAD)

VECTOR_SHA=$(git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop

DIST_VERSION=$VECTOR_SHA-react-$REACT_SHA-js-$JSSDK_SHA scripts/package.sh -d
