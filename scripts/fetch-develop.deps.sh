#!/bin/bash

# Fetches the js-sdk and matrix-react-sdk dependencies for development
# or testing purposes
# If there exists a branch of that dependency with the same name as
# the branch the current checkout is on, use that branch. Otherwise,
# use develop.

set -ex

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
        git clone git://github.com/$org/$repo.git $repo --branch $branch \
            "${GIT_CLONE_ARGS[@]}"
        return $?
    fi
    return 1
}

function dodep() {
    deforg=$1
    defrepo=$2
    rm -rf $defrepo

    # Try the PR author's branch in case it exists on the deps as well.
    # Try the target branch of the push or PR.
    # Use the default branch as the last resort.
    if [[ "$BUILDKITE" == true ]]; then
        # If BUILDKITE_BRANCH is set, it will contain either:
        #   * "branch" when the author's branch and target branch are in the same repo
        #   * "author:branch" when the author's branch is in their fork
        # We can split on `:` into an array to check.
        BUILDKITE_BRANCH_ARRAY=(${BUILDKITE_BRANCH//:/ })
        if [[ "${#BUILDKITE_BRANCH_ARRAY[@]}" == "2" ]]; then
            prAuthor=${BUILDKITE_BRANCH_ARRAY[0]}
            prBranch=${BUILDKITE_BRANCH_ARRAY[1]}
        else
            prAuthor=$deforg
            prBranch=$BUILDKITE_BRANCH
        fi
        clone $prAuthor $defrepo $prBranch ||
        clone $deforg $defrepo $BUILDKITE_PULL_REQUEST_BASE_BRANCH ||
        clone $deforg $defrepo $defbranch ||
        return $?
    else
        clone $deforg $defrepo $ghprbSourceBranch ||
        clone $deforg $defrepo $GIT_BRANCH ||
        clone $deforg $defrepo `git rev-parse --abbrev-ref HEAD` ||
        clone $deforg $defrepo $defbranch ||
        return $?
    fi

    echo "$defrepo set to branch "`git -C "$defrepo" rev-parse --abbrev-ref HEAD`
}

##############################

echo 'Setting up matrix-js-sdk'

dodep matrix-org matrix-js-sdk

pushd matrix-js-sdk
yarn link
yarn install
popd

yarn link matrix-js-sdk

##############################

echo 'Setting up matrix-react-sdk'

dodep matrix-org matrix-react-sdk

pushd matrix-react-sdk
yarn link
yarn link matrix-js-sdk
yarn install
yarn reskindex
popd

yarn link matrix-react-sdk

##############################

# Link the reskindex binary in place: if we used `yarn link`,
# Yarn would do this for us, but we don't because we'd have
# to define the Yarn binary prefix somewhere so it could put the
# intermediate symlinks there. Instead, we do it ourselves.
mkdir -p node_modules/.bin
ln -sfv ../matrix-react-sdk/scripts/reskindex.js node_modules/.bin/reskindex
