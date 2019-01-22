#!/bin/bash
#
# Script to perform a release of vector-web.
#
# Requires github-changelog-generator; to install, do
#   pip install git+https://github.com/matrix-org/github-changelog-generator.git

set -e

orig_args=$@

# chomp any args starting with '-' as these need to go
# through to the release script and otherwise we'll get
# confused about what the version arg is.
while [[ "$1" == -* ]]; do
    shift
done

cd `dirname $0`

for i in matrix-js-sdk matrix-react-sdk
do
    depver=`cat package.json | jq -r .dependencies[\"$i\"]`
    latestver=`npm show $i version`
    if [ "$depver" != "$latestver" ]
    then
        echo "The latest version of $i is $latestver but package.json depends on $depver"
        echo -n "Type 'Yes' to continue anyway: "
        read resp
        if [ "$resp" != "Yes" ]
        then
            echo "OK, never mind."
            exit 1
        fi
    fi
done

# bump Electron's package.json first
release="${1#v}"
tag="v${release}"
echo "electron npm version"

cd electron_app
npm version --no-git-tag-version "$release"
git commit package.json -m "$tag"


cd ..

exec ./node_modules/matrix-js-sdk/release.sh -u vector-im -z "$orig_args"
