#!/bin/bash

set -e

usage() {
    echo "Usage: $0 -v <version> -c <config file> [-n]"
    echo
    echo "version: commit-ish to check out and build"
    echo "config file: a path to a json config file to"
    echo "ship with the build. In addition, update_base_url:"
    echo "from this file is used to set up auto-update."
    echo "-n: build with no config file."
    echo
    echo "Values may also be passed as environment variables"
}

conffile=
version=
skipcfg=0
while getopts "c:v:n" opt; do
    case $opt in
        c)
            conffile=$OPTARG
            ;;
        v)
            version=$OPTARG
            ;;
        n)
            skipcfg=1
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            usage
            exit
            ;;
    esac
done

if [ -z "$version" ]; then
    echo "No version supplied"
    usage
    exit
fi

if [ -z "$conffile" ] && [ "$skipcfg" = 0 ]; then
    echo "No config file given. Use -c to supply a config file or"
    echo "-n to build with no config file (and no auto update)."
    exit
fi

if [ -n "$conffile" ]; then
    update_base_url=`jq -r .update_base_url $conffile`

    if [ -z "$update_base_url" ]; then
        echo "No update URL supplied. Use update_base_url: null if you really"
        echo "want a build with no auto-update."
        usage
        exit
    fi
    # Make sure the base URL ends in a slash if it doesn't already
    update_base_url=`echo $update_base_url | sed -e 's#\([^\/]\)$#\1\/#'`
fi

if [ ! -f package.json ]; then
    echo "No package.json found. This script must be run from"
    echo "the riot-web directory."
    exit
fi

echo "Building $version using Update base URL $update_base_url"

projdir=`pwd`
builddir=`mktemp -d 2>/dev/null || mktemp -d -t 'buildtmp'`
pushd "$builddir"

git clone "$projdir" .
git checkout "$version"

# Figure out what version we're building
vername=`jq -r .version package.json`

if [ -n "$conffile" ]; then
    popd
    cp "$conffile" "$builddir/"
    pushd "$builddir"
fi

npm install
npm run build:electron

popd

distdir="$builddir/electron_app/dist"
pubdir="$projdir/electron_app/pub"
rm -r "$pubdir" || true
mkdir -p "$pubdir"
rm -r "$projdir/electron_app/dist" || true
mkdir -p "$projdir/electron_app/dist/unsigned/"

# Install packages: what the user downloads the first time,
# (DMGs for mac, exe installer for windows)
mkdir -p "$pubdir/install/macos"
cp $distdir/*.dmg "$pubdir/install/macos/"

# Windows installers go to the dist dir because they need signing
mkdir -p "$pubdir/install/win32/ia32/"
mkdir -p "$projdir/electron_app/dist/unsigned/ia32/"
cp $distdir/squirrel-windows-ia32/*.exe "$projdir/electron_app/dist/unsigned/ia32/"

mkdir -p "$pubdir/install/win32/x64/"
mkdir -p "$projdir/electron_app/dist/unsigned/x64/"
cp $distdir/squirrel-windows/*.exe "$projdir/electron_app/dist/unsigned/x64/"

# Packages for auto-update
mkdir -p "$pubdir/update/macos"
cp $distdir/*-mac.zip "$pubdir/update/macos/"
echo "$vername" > "$pubdir/update/macos/latest"

mkdir -p "$pubdir/update/win32/ia32/"
cp $distdir/squirrel-windows-ia32/*.nupkg "$pubdir/update/win32/ia32/"
cp $distdir/squirrel-windows-ia32/RELEASES "$pubdir/update/win32/ia32/"

mkdir -p "$pubdir/update/win32/x64/"
cp $distdir/squirrel-windows/*.nupkg "$pubdir/update/win32/x64/"
cp $distdir/squirrel-windows/RELEASES "$pubdir/update/win32/x64/"

# Move the debs to the main project dir's dist folder
cp $distdir/*.deb "$projdir/electron_app/dist/"

rm -rf "$builddir"

echo "Unsigned Windows installers have been placed in electron_app/dist/unsigned/ - sign them,"
echo "or just copy them to "$pubdir/install/win32/\<arch\>/""
echo "Once you've done this, $pubdir can be hosted on your web server."
echo "deb archives are in electron_app/dist/ - these should be added into your debian repository"
