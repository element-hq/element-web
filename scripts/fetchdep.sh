#!/bin/bash

set -x

deforg="$1"
defrepo="$2"
defbranch="$3"

[ -z "$defbranch" ] && defbranch="develop"

rm -r "$defrepo" || true

clone() {
    org=$1
    repo=$2
    branch=$3
    if [ -n "$branch" ]
    then
        echo "Trying to use $org/$repo#$branch"
        git clone git://github.com/$org/$repo.git $repo --branch "$branch" --depth 1 && exit 0
    fi
}

# Try the PR author's branch in case it exists on the deps as well.
# First we check if GITHUB_HEAD_REF is defined,
# Then we check if BUILDKITE_BRANCH is defined,
# if they aren't we can assume this is a Netlify build
if [ -n "$GITHUB_HEAD_REF" ]; then
    head=$GITHUB_HEAD_REF
elif [ -n "$BUILDKITE_BRANCH" ]; then
	head=$BUILDKITE_BRANCH
else
    # Netlify doesn't give us info about the fork so we have to get it from GitHub API
    apiEndpoint="https://api.github.com/repos/matrix-org/matrix-react-sdk/pulls/"
    apiEndpoint+=$REVIEW_ID
    head=$(curl $apiEndpoint | jq -r '.head.label')
fi

# If head is set, it will contain on Buildkite either:
#   * "branch" when the author's branch and target branch are in the same repo
#   * "fork:branch" when the author's branch is in their fork or if this is a Netlify build
# We can split on `:` into an array to check.
# For GitHub Actions we need to inspect GITHUB_REPOSITORY and GITHUB_ACTOR
# to determine whether the branch is from a fork or not
BRANCH_ARRAY=(${head//:/ })
if [[ "${#BRANCH_ARRAY[@]}" == "1" ]]; then

    if [ -n "$GITHUB_HEAD_REF" ]; then
        if [[ "$GITHUB_REPOSITORY" == "$deforg"* ]]; then
            clone $deforg $defrepo $GITHUB_HEAD_REF
        else
            REPO_ARRAY=(${GITHUB_REPOSITORY//\// })
            clone $REPO_ARRAY[0] $defrepo $GITHUB_HEAD_REF
        fi
    else
        clone $deforg $defrepo $BUILDKITE_BRANCH
    fi

elif [[ "${#BRANCH_ARRAY[@]}" == "2" ]]; then
    clone ${BRANCH_ARRAY[0]} $defrepo ${BRANCH_ARRAY[1]}
fi

# Try the target branch of the push or PR.
if [ -n $GITHUB_BASE_REF ]; then
    clone $deforg $defrepo $GITHUB_BASE_REF
elif [ -n $BUILDKITE_PULL_REQUEST_BASE_BRANCH ]; then
    clone $deforg $defrepo $BUILDKITE_PULL_REQUEST_BASE_BRANCH
fi

# Try HEAD which is the branch name in Netlify (not BRANCH which is pull/xxxx/head for PR builds)
clone $deforg $defrepo $HEAD
# Use the default branch as the last resort.
clone $deforg $defrepo $defbranch
