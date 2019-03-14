#!/bin/bash

# Fetches the js-sdk and matrix-react-sdk dependencies for development
# or testing purposes
# If there exists a branch of that dependency with the same name as
# the branch the current checkout is on, use that branch. Otherwise,
# use develop.

set -e

GIT_CLONE_ARGS=("$@")
[ -z "$defbranch" ] && defbranch="develop"

# clone a specific branch of a github repo
function clone() {
    org=$1
    repo=$2
    branch=$3

    # Chop 'origin' off the start as jenkins ends up using
    # branches on the origin, but this doesn't work if we
    # specify the branch when cloning.
    branch=${branch#origin/}

    if [ -n "$branch" ]
    then
        echo "Trying to use $org/$repo#$branch"
        git clone https://github.com/$org/$repo.git $repo --branch $branch \
            "${GIT_CLONE_ARGS[@]}"
        return $?
    fi
    return 1
}

function dodep() {
    org=$1
    repo=$2
    rm -rf $repo

    # Try the PR author's branch in case it exists on the deps as well.
    # Try the target branch of the push or PR.
    # Use the default branch as the last resort.
    if [[ "$BUILDKITE" == true ]]; then
        clone $org $repo $BUILDKITE_BRANCH ||
        clone $org $repo $defbranch ||
        return $?
    else
        clone $org $repo $ghprbSourceBranch ||
        clone $org $repo $GIT_BRANCH ||
        clone $org $repo `git rev-parse --abbrev-ref HEAD` ||
        clone $org $repo $defbranch ||
        return $?
    fi

    echo "$repo set to branch "`git -C "$repo" rev-parse --abbrev-ref HEAD`
}

##############################

echo -en 'travis_fold:start:matrix-js-sdk\r'
echo 'Setting up matrix-js-sdk'

dodep matrix-org matrix-js-sdk

pushd matrix-js-sdk
yarn link
yarn install
popd

yarn link matrix-js-sdk

echo -en 'travis_fold:end:matrix-js-sdk\r'

##############################

echo -en 'travis_fold:start:matrix-react-sdk\r'
echo 'Setting up matrix-react-sdk'

dodep matrix-org matrix-react-sdk

pushd matrix-react-sdk
yarn link
yarn link matrix-js-sdk
yarn install
popd

yarn link matrix-react-sdk

echo -en 'travis_fold:end:matrix-react-sdk\r'

##############################

# Link the reskindex binary in place: if we used `yarn link`,
# Yarn would do this for us, but we don't because we'd have
# to define the Yarn binary prefix somewhere so it could put the
# intermediate symlinks there. Instead, we do it ourselves.
mkdir -p node_modules/.bin
ln -sfv ../matrix-react-sdk/scripts/reskindex.js node_modules/.bin/reskindex
