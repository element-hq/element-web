#!/bin/sh
#
# Script to perform a release of matrix-react-sdk.
#
# Requires githib-changelog-generator; to install, do 
#   pip install git+https://github.com/matrix-org/github-changelog-generator.git

set -e

cd `dirname $0`

for i in matrix-js-sdk
do
    depver=`cat package.json | jq -r .dependencies[\"$i\"]`
    latestver=`yarn info -s $i dist-tags.next`
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

exec ./node_modules/matrix-js-sdk/release.sh -z "$@"
