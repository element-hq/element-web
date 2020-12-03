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
# If BUILDKITE_BRANCH is set, it will contain either:
#   * "branch" when the author's branch and target branch are in the same repo
#   * "author:branch" when the author's branch is in their fork
# We can split on `:` into an array to check.
BUILDKITE_BRANCH_ARRAY=(${BUILDKITE_BRANCH//:/ })
if [[ "${#BUILDKITE_BRANCH_ARRAY[@]}" == "1" ]]; then
    clone $deforg $defrepo $BUILDKITE_BRANCH
elif [[ "${#BUILDKITE_BRANCH_ARRAY[@]}" == "2" ]]; then
    clone ${BUILDKITE_BRANCH_ARRAY[0]} $defrepo ${BUILDKITE_BRANCH_ARRAY[1]}
fi
# Try the target branch of the push or PR.
clone $deforg $defrepo $BUILDKITE_PULL_REQUEST_BASE_BRANCH
# Try HEAD which is the branch name in Netlify (not BRANCH which is pull/xxxx/head for PR builds)
clone $deforg $defrepo $HEAD
# Use the default branch as the last resort.
clone $deforg $defrepo $defbranch
