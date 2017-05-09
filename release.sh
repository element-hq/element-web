#!/bin/bash
#
# Script to perform a release of vector-web.
#
# Requires github-changelog-generator; to install, do 
#   pip install git+https://github.com/matrix-org/github-changelog-generator.git

set -e

cd `dirname $0`


# bump Electron's package.json first
release="${1#v}"
tag="v${release}"
echo "electron npm version"

cd electron
npm version --no-git-tag-version "$release"
git commit package.json -m "$tag"


cd ..

exec ./node_modules/matrix-js-sdk/release.sh -z "$@"
