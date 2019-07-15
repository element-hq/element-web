#!/bin/bash
# 
# Builds and installs iohook for Push-to-Talk functionality
#
# Dependencies
#
# Common:
# - npm, yarn
# 
# Linux:
# - apt install build-essentials cmake
#
# MacOS:
# - Xcode developer tools
# - brew
# - brew install cmake automake libtool pkg-config

set -ex

electron_version="4.2.6"
abi="69"

echo "Detecting OS..."
case "$OSTYPE" in
  darwin*)
    echo "Found MacOS"
    ostype="darwin"
    ;;
  msys*)
    echo "Windows is unsupported at this time"
    ;;
  *)
    echo "Found Linux."
    ostype="linux"
    ;;
esac

echo "Detecting architecture..."
MACHINE_TYPE=`uname -m`
if [ ${MACHINE_TYPE} == "x86_64" ]; then
  echo "Found 64 bit..."
  osarch="64"
else
  echo "Found 32 bit..."
  osarch="32"
fi

# Get dependencies
echo "Getting dependencies..."
yarn

# Riot currently does not install the correct electron version, so collect it
# manually
yarn add electron@v$electron_version

# Build iohook
echo "Building iohook..."
cd electron_app

# iohook attempts to download a pre-built package for node ABI v72, which does
# not exist
yarn || echo "Ignoring broken pre-build packages"
cd node_modules
rm -rf iohook
git clone https://github.com/matrix-org/iohook
cd iohook
npm i || echo "Ignoring broken pre-build packages"
rm -rf builds/*
npm run build
node build.js --runtime electron --version $electron_version --abi $abi --no-upload

# Install
echo "Installing built package"
folder="electron-v$abi-$ostype-x$osarch"
mkdir -p builds/$folder/build/Release
cp build/Release/iohook.node builds/$folder/build/Release/

echo "Done!"
