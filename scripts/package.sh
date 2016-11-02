#!/bin/sh

set -e

if [ $# -eq 1 ]; then
    version=$1
else
    version=`git describe --dirty --tags || echo unknown`
fi

npm run build
mkdir -p dist
cp -r vector vector-$version
echo $version > vector-$version/version
tar chvzf dist/vector-$version.tar.gz vector-$version
rm -r vector-$version

echo
echo "Packaged dist/vector-$version.tar.gz"
