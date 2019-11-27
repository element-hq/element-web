#!/bin/bash

usage() {
    echo "Usage: $0 -v <version> -d <config directory> [-n]"
    echo
    echo "version: commit-ish to check out and build"
    echo "config directory: a path to a directory containing"
    echo "config.json, a json config file to ship with the build"
    echo "and env.sh, a file to source environment variables"
    echo "from."
    echo "-n: build with no config file."
    echo
    echo "The update_base_url value from config.json is used to set up auto-update."
    echo
    echo "Environment variables:"
    echo "   OSSLSIGNCODE_SIGNARGS: Arguments to pass to osslsigncode when signing"
    echo "   NOTARIZE_APPLE_ID: Apple ID to use for notarisation. The password for"
    echo "   this account must be set in NOTARIZE_CREDS in the keychain."
}

confdir=
version=
skipcfg=0
while getopts "d:v:n" opt; do
    case $opt in
        d)
            confdir=$OPTARG
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

conffile="$confdir/config.json"

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

[ -f "$confdir/env.sh" ] && . "$confdir/env.sh"

if [ -z "$NOTARIZE_APPLE_ID" ]; then
    echo "NOTARIZE_APPLE_ID is not set"
    exit
fi

osslsigncode -h 2> /dev/null
if [ $? -ne 255 ]; then # osslsigncode exits with 255 after printing usage...
    echo "osslsigncode not found"
    exit
fi

# Test that altool can get its credentials for notarising the mac app
xcrun altool -u "$NOTARIZE_APPLE_ID" -p '@keychain:NOTARIZE_CREDS' --list-apps || exit

# Get the token password: we'll need it later, but get it now so we fail early if it's not there
token_password=`security find-generic-password -s riot_signing_token -w`
if [ $? -ne 0 ]; then
    echo "riot_signing_token not found in keychain"
    exit
fi

set -e

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

# We use Git branch / commit dependencies for some packages, and Yarn seems
# to have a hard time getting that right. See also
# https://github.com/yarnpkg/yarn/issues/4734. As a workaround, we clean the
# global cache here to ensure we get the right thing.
yarn cache clean
yarn install
yarn build:electron

popd

distdir="$builddir/electron_app/dist"
pubdir="$projdir/electron_app/pub"
rm -r "$pubdir" || true
mkdir -p "$pubdir"
rm -r "$projdir/electron_app/dist" || true
mkdir -p "$projdir/electron_app/dist"

# Install packages: what the user downloads the first time,
# (DMGs for mac, exe installer for windows)
mkdir -p "$pubdir/install/macos"
cp $distdir/*.dmg "$pubdir/install/macos/"

mkdir -p "$pubdir/install/win32/ia32/"
cp $distdir/squirrel-windows-ia32/*.exe "$pubdir/install/win32/ia32/"

mkdir -p "$pubdir/install/win32/x64/"
cp $distdir/squirrel-windows/*.exe "$pubdir/install/win32/x64/"

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

# Move the deb to the main project dir's dist folder
# (just the 64 bit one - the 32 bit one still gets built because
# it's one arch argument for all platforms and we still want 32 bit
# windows, but 32 bit linux is unsupported as of electron 4 and no
# longer appears to work).
cp $distdir/*_amd64.deb "$projdir/electron_app/dist/"

rm -rf "$builddir"

echo "$pubdir can now be hosted on your web server."
echo "deb archives are in electron_app/dist/ - these should be added into your debian repository"
