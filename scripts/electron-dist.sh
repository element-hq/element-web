#!/bin/bash

set -e
set -x

if [ $# = 0 ]; then
    echo "Usage: $0 <target directory>"
    echo ""
    echo "Adds the build in electron/dist/ to a given Riot electron"
    echo "download tree. If target directory is empty, create a new"
    echo "download tree. This tree can be placed on a web server to"
    echo "serve auto-updates (although auto-update for Mac requires"
    echo "additional logic)."
    exit
fi

ver=`basename electron/dist/mac/*.dmg | cut -d '-' -f 2 | sed -e 's/\.dmg$//'`
dir=$1

echo "Copying files for version $ver to $dir"

# Install packages: what the user downloads the first time,
# (DMGs for mac, exe installer for windows)
mkdir -p "$dir/install/macos"
cp electron/dist/mac/*.dmg "$dir/install/macos/"
echo "$ver" > "$dir/install/macos/latest"

mkdir -p "$dir/install/win32/ia32"
cp electron/dist/win-ia32/*.exe "$dir/install/win32/ia32/"

mkdir -p "$dir/install/win32/x64"
cp electron/dist/win/*.exe "$dir/install/win32/ia32/"


# Packages for auto-update. It would be nice if squirrel's
# auto update used the installer packages, but it doesn't
# for Reasons. zip for mac, nupkg for windows.
mkdir -p "$dir/update/macos"
cp electron/dist/mac/*.zip "$dir/update/macos/"
echo "$ver" > "$dir/update/macos/latest"

mkdir -p "$dir/update/win32/ia32"
cp electron/dist/win-ia32/*.nupkg "$dir/update/win32/ia32/"
cat electron/dist/win-ia32/RELEASES >> "$dir/update/win32/ia32/RELEASES"
echo >> "$dir/update/win32/ia32/RELEASES"

mkdir -p "$dir/update/win32/x64"
cp electron/dist/win/*.nupkg "$dir/update/win32/x64/"
cat electron/dist/win/RELEASES >> "$dir/update/win32/x64/RELEASES"
echo >> "$dir/update/win32/x64/RELEASES"


echo "All done!"
echo "$dir can now be copied to your web server."
