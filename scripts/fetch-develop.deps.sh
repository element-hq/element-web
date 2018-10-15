#!/bin/bash

# Fetches the js-sdk and matrix-react-sdk dependencies for development
# or testing purposes
# If there exists a branch of that dependency with the same name as
# the branch the current checkout is on, use that branch. Otherwise,
# use develop.

set -e

GIT_CLONE_ARGS=("$@")

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

# Chop 'origin' off the start as jenkins ends up using
# branches on the origin, but this doesn't work if we
# specify the branch when cloning.
curbranch=${curbranch#origin/}

echo "Determined branch to be $curbranch"

# clone a specific branch of a github repo
function clone() {
    org=$1
    repo=$2
    branch=$3
    git clone https://github.com/$org/$repo.git $repo --branch $branch \
        "${GIT_CLONE_ARGS[@]}"
}

function dodep() {
    org=$1
    repo=$2
    rm -rf $repo
    clone $org $repo $curbranch || {
        [ "$curbranch" != 'develop' ] && clone $org $repo develop
    } || return $?

    echo "$repo set to branch "`git -C "$repo" rev-parse --abbrev-ref HEAD`

    mkdir -p node_modules
    npm link "./$repo"  # This does an npm install for us
}

##############################

echo -en 'travis_fold:start:matrix-js-sdk\r'
echo 'Setting up matrix-js-sdk'

dodep matrix-org matrix-js-sdk

echo -en 'travis_fold:end:matrix-js-sdk\r'

##############################

echo -en 'travis_fold:start:matrix-react-sdk\r'
echo 'Setting up matrix-react-sdk'

dodep matrix-org matrix-react-sdk

# replace the version of js-sdk that got pulled into react-sdk with a link
# to our version. Make sure to do this *after* doing 'npm i' in react-sdk,
# otherwise npm helpfully moves another-json from matrix-js-sdk/node_modules
# into matrix-react-sdk/node_modules.
#
# (note this matches the instructions in the README.)
cd matrix-react-sdk
npm link ../matrix-js-sdk
cd ../

echo -en 'travis_fold:end:matrix-react-sdk\r'

##############################

# Link the reskindex binary in place: if we used npm link,
# npm would do this for us, but we don't because we'd have
# to define the npm prefix somewhere so it could put the
# intermediate symlinks there. Instead, we do it ourselves.
mkdir -p node_modules/.bin
ln -sfv ../matrix-react-sdk/scripts/reskindex.js node_modules/.bin/reskindex
