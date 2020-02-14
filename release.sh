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
        echo "The latest version of $i is $latestver but package.json depends on $depver."
        echo -n "Type 'u' to auto-upgrade, 'c' to continue anyway, or 'a' to abort:"
        read resp
        if [ "$resp" != "u" ] && [ "$resp" != "c" ]
        then
            echo "Aborting."
            exit 1
        fi
        if [ "$resp" == "u" ]
        then
            echo "Upgrading $i to $latestver..."
            yarn add -E $i@$latestver
            git add -u
            # The `-e` flag opens the editor and gives you a chance to check
            # the upgrade for correctness.
            git commit -m "Upgrade $i to $latestver" -e
        fi
    fi
done

exec ./node_modules/matrix-js-sdk/release.sh -z "$@"
