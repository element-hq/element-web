#!/bin/bash

set -x

deforg="$1"
defrepo="$2"
defbranch="$3"

[ -z "$defbranch" ] && defbranch="develop"

rm -r "$defrepo" || true

# figure out where to look for pull requests:
#   - We may have been told an explicit repo via the PR_ORG/PR_REPO/PR_NUMBER env vars
#   - otherwise, check the $GITHUB_ env vars which are set by Github Actions
#   - failing that, fall back to the matrix-org/matrix-react-sdk repo.
#
# in ether case, the PR_NUMBER variable must be set explicitly.
default_org_repo=${GITHUB_REPOSITORY:-"matrix-org/matrix-react-sdk"}
PR_ORG=${PR_ORG:-${default_org_repo%%/*}}
PR_REPO=${PR_REPO:-${default_org_repo##*/}}

# A function that clones a branch of a repo based on the org, repo and branch
clone() {
    org=$1
    repo=$2
    branch=$3
    if [ -n "$branch" ]
    then
        echo "Trying to use $org/$repo#$branch"
        # Disable auth prompts: https://serverfault.com/a/665959
        GIT_TERMINAL_PROMPT=0 git clone https://github.com/$org/$repo.git $repo --branch "$branch" --depth 1 && exit 0
    fi
}

# A function that gets info about a PR from the GitHub API based on its number
getPRInfo() {
    number=$1
    if [ -n "$number" ]; then
        echo "Getting info about a PR with number $number"

        apiEndpoint="https://api.github.com/repos/$PR_ORG/$PR_REPO/pulls/$number"

        head=$(curl $apiEndpoint | jq -r '.head.label')
    fi
}

# Some CIs don't give us enough info, so we just get the PR number and ask the
# GH API for more info - "fork:branch". Some give us this directly.
if [ -n "$BUILDKITE_BRANCH" ]; then
    # BuildKite
    head=$BUILDKITE_BRANCH
elif [ -n "$PR_NUMBER" ]; then
    # GitHub
    getPRInfo $PR_NUMBER
elif [ -n "$REVIEW_ID" ]; then
    # Netlify
    getPRInfo $REVIEW_ID
fi

# for forks, $head will be in the format "fork:branch", so we split it by ":"
# into an array. On non-forks, this has the effect of splitting into a single
# element array given ":" shouldn't appear in the head - it'll just be the
# branch name. Based on the results, we clone.
BRANCH_ARRAY=(${head//:/ })
TRY_ORG=$deforg
TRY_BRANCH=${BRANCH_ARRAY[0]}
if [[ "$head" == *":"* ]]; then
    # ... but only match that fork if it's a real fork
    if [ "${BRANCH_ARRAY[0]}" != "$PR_ORG" ]; then
        TRY_ORG=${BRANCH_ARRAY[0]}
    fi
    TRY_BRANCH=${BRANCH_ARRAY[1]}
fi
clone ${TRY_ORG} $defrepo ${TRY_BRANCH}

# Try the target branch of the push or PR.
if [ -n "$GITHUB_BASE_REF" ]; then
    clone $deforg $defrepo $GITHUB_BASE_REF
elif [ -n "$BUILDKITE_PULL_REQUEST_BASE_BRANCH" ]; then
    clone $deforg $defrepo $BUILDKITE_PULL_REQUEST_BASE_BRANCH
fi

# Try HEAD which is the branch name in Netlify (not BRANCH which is pull/xxxx/head for PR builds)
clone $deforg $defrepo $HEAD
# Use the default branch as the last resort.
clone $deforg $defrepo $defbranch
