#!/bin/sh

org="$1"
repo="$2"
defbranch="$3"

[ -z "$defbranch" ] && defbranch="develop"

rm -r "$repo" || true

clone() {
    branch=$1
    if [ -n "$branch" ]
    then
        echo "Trying to use the branch $branch"
        git clone https://github.com/$org/$repo.git $repo --branch "$branch" && exit 0
    fi
}

# Try the PR author's branch in case it exists on the deps as well.
clone $TRAVIS_PULL_REQUEST_BRANCH
# Try the target branch of the push or PR.
clone $TRAVIS_BRANCH
# Try the current branch from Jenkins.
clone `"echo $GIT_BRANCH" | sed -e 's/^origin\///'`
# Use the default branch as the last resort.
clone $defbranch
