#!/bin/bash

# Fetches the js-sdk and matrix-react-sdk dependencies for development
# or testing purposes
# If there exists a branch of that dependency with the same name as
# the branch the current checkout is on, use that branch. Otherwise,
# use develop.

# Look in the many different CI env vars for which branch we're
# building
if [[ "$TRAVIS" == true ]]; then
    curbranch="${TRAVIS_PULL_REQUEST_BRANCH:-$TRAVIS_BRANCH}"
else
    # ghprbSourceBranch for jenkins github pull request builder
    # GIT_BRANCH for other jenkins builds
    curbranch="${ghprbSourceBranch:-$GIT_BRANCH}"
    # Otherwise look at the actual branch we're on
    if [ -z "$curbranch" ]
    then
        curbranch=`git rev-parse --abbrev-ref HEAD`
    fi
fi

echo "Determined branch to be $curbranch"

function dodep() {
    org=$1
    repo=$2
    rm -rf $repo || true
    git clone https://github.com/$org/$repo.git $repo
    pushd $repo
    git checkout $curbranch || git checkout develop
    echo "$repo set to branch "`git rev-parse --abbrev-ref HEAD`
    popd
}

dodep matrix-org matrix-js-sdk
dodep matrix-org matrix-react-sdk

mkdir -p node_modules
cd node_modules

ln -s ../matrix-js-sdk ./
pushd matrix-js-sdk
npm install
popd

ln -s ../matrix-react-sdk ./
pushd matrix-react-sdk
mkdir -p node_modules
cd node_modules
ln -s ../../matrix-js-sdk matrix-js-sdk
cd ..
npm install
popd
# Link the reskindex binary in place: if we used npm link,
# npm would do this for us, but we don't because we'd have
# to define the npm prefix somewhere so it could put the
# intermediate symlinks there. Instead, we do it ourselves.
mkdir -p .bin
ln -sf ../matrix-react-sdk/scripts/reskindex.js .bin/reskindex
