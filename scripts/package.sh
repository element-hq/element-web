#!/bin/sh

set -e

version=`git describe --dirty --tags || echo unknown`

npm run build
mkdir -p packages
cp -r vector vector-$version
echo $version > vector-$version/version
tar chvzf packages/vector-$version.tar.gz vector-$version
rm -r vector-$version

echo
echo "Packaged packages/vector-$version.tar.gz"
