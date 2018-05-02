#!/bin/sh

set -e

org="$1"
repo="$2"

curbranch="${TRAVIS_PULL_REQUEST_BRANCH:-$TRAVIS_BRANCH}"
echo "Determined branch to be $curbranch"

git clone https://github.com/$org/$repo.git $repo --branch "$curbranch" || git clone https://github.com/$org/$repo.git $repo --branch develop

