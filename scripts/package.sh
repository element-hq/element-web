#!/bin/bash

set -e

if [ -n "$DIST_VERSION" ]; then
    version=$DIST_VERSION
else
    version=`git describe --dirty --tags || echo unknown`
fi

yarn clean
yarn build

# include the sample config in the tarball. Arguably this should be done by
# `yarn build`, but it's just too painful.
cp config.sample.json webapp/

mkdir -p dist
cp -r webapp riot-$version

# Just in case you have a local config, remove it before packaging
rm riot-$version/config.json || true

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
