#!/bin/sh

set -e

org="$1"
repo="$2"

curbranch="$TRAVIS_PULL_REQUEST_BRANCH"
[ -z "$curbranch" ] && curbranch="$TRAVIS_BRANCH"
[ -z "$curbranch" ] && curbranch=`"$GIT_BRANCH" | sed -e 's/^origin\///'` # jenkins

if [ -n "$curbranch" ]
then
    echo "Determined branch to be $curbranch"

    git clone https://github.com/$org/$repo.git $repo --branch "$curbranch" && exit 0
fi

echo "Checking out develop branch"
git clone https://github.com/$org/$repo.git $repo --branch develop
