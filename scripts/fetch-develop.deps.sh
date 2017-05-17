#!/bin/sh

# Fetches the js-sdk and matrix-react-sdk dependencies for development
# or testing purposes
# If there exists a branch of that dependency with the same name as
# the branch the current checkout is on, use that branch. Otherwise,
# use develop.

curbranch=`git rev-parse --abbrev-ref HEAD`

mkdir -p node_modules
cd node_modules

function dodep() {
    org=$1
    repo=$2
    rm -rf $repo || true
    git clone https://github.com/$org/$repo.git $repo
    pushd $repo
    git checkout $curbranch || git checkout develop
    npm install
    echo "$repo set to branch "`git rev-parse --abbrev-ref HEAD`
    popd
}

dodep matrix-org matrix-js-sdk
dodep matrix-org matrix-react-sdk
