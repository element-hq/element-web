#!/bin/bash

set -e

dev=""
if [ "$1" = '-d' ]; then
    dev=":dev"
fi

if [ -n "$DIST_VERSION" ]; then
    version=$DIST_VERSION
else
    version=`git describe --dirty --tags || echo unknown`
fi

npm run clean
# riot-web is at `workspace`.
# matrix-react-sdk is at `workspace/node_modules/matrix-react-sdk`, but this is
# symlinked to a repo at `workspace/matrix-react-sdk`.
# To get from `workspace/matrix-react-sdk/lib` up to the lang file, we use:
RIOT_LANGUAGES_FILE="../../webapp/i18n/languages.json" npm run build$dev

# include the sample config in the tarball. Arguably this should be done by
# `npm run build`, but it's just too painful.
cp config.sample.json webapp/

mkdir -p dist
cp -r webapp riot-$version

# if $version looks like semver with leading v, strip it before writing to file
if [[ ${version} =~ ^v[[:digit:]]+\.[[:digit:]]+\.[[:digit:]]+(-.+)?$ ]]; then
    echo ${version:1} > riot-$version/version
else
    echo ${version} > riot-$version/version
fi

tar chvzf dist/riot-$version.tar.gz riot-$version
rm -r riot-$version

echo
echo "Packaged dist/riot-$version.tar.gz"
