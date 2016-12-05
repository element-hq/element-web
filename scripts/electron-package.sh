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
    echo "the vector-web directory."
    exit
fi

echo "Building $version using Update base URL $update_base_url"

projdir=`pwd`
builddir=`mktemp -d 2>/dev/null || mktemp -d -t 'buildtmp'`
pushd "$builddir"
git clone "$projdir" .
git checkout "$version"

if [ -n "$conffile" ]; then
    popd
    cp "$conffile" "$builddir/"
    pushd "$builddir"
fi

npm install
npm run build:electron

popd

distdir="$builddir/electron/dist"
pubdir="$projdir/electron/pub"
rm -r "$pubdir" || true
mkdir -p "$pubdir"

# Install packages: what the user downloads the first time,
# (DMGs for mac, exe installer for windows)
mkdir -p "$pubdir/install/macos"
cp $distdir/mac/*.dmg "$pubdir/install/macos/"

mkdir -p "$pubdir/install/win32/ia32/"
cp $distdir/win-ia32/*.exe "$pubdir/install/win32/ia32/"

mkdir -p "$pubdir/install/win32/x64/"
cp $distdir/win/*.exe "$pubdir/install/win32/x64/"

# Packages for auto-update
mkdir -p "$pubdir/update/macos"
cp $distdir/mac/*.zip "$pubdir/update/macos/"
echo "$ver" > "$pubdir/update/macos/latest"

mkdir -p "$pubdir/update/win32/ia32/"
cp $distdir/win-ia32/*.nupkg "$pubdir/update/win32/ia32/"
cp $distdir/win-ia32/RELEASES "$pubdir/install/win32/ia32/"

mkdir -p "$pubdir/update/win32/x64/"
cp $distdir/win/*.nupkg "$pubdir/update/win32/x64/"
cp $distdir/win/RELEASES "$pubdir/update/win32/x64/"

# Move the debs to the main project dir's dist folder
rm -r "$projdir/electron/dist" || true
mkdir -p "$projdir/electron/dist"
cp $distdir/*.deb "$projdir/electron/dist/"

rm -rf "$builddir"

echo "Riot Desktop is ready to go in $pubdir: this directory can be hosted on your web server."
echo "deb archives are in electron/dist/ - these should be added into your debian repository"
