#!/bin/sh

set -e

version=`git describe --dirty --tags || echo unknown`

npm run build
mkdir -p packages
ln -s vector vector-$version
tar chvzf packages/vector-$version.tar.gz vector-$version
rm vector-$version

echo
echo "Packaged packages/vector-$version.tar.gz"
