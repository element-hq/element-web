#!/bin/bash
#
# Script to perform a release of matrix-js-sdk and downstream projects.
#
# Requires:
#   jq; install from your distribution's package manager (https://stedolan.github.io/jq/)
#   hub; install via brew (macOS) or source/pre-compiled binaries (debian) (https://github.com/github/hub) - Tested on v2.2.9
#   yarn; install via brew (macOS) or similar (https://yarnpkg.com/docs/install/)
#
# Note: this script is also used to release matrix-react-sdk, element-web, and element-desktop.

set -e

jq --version > /dev/null || (echo "jq is required: please install it"; kill $$)
if [[ $(command -v hub) ]] && [[ $(hub --version) =~ hub[[:space:]]version[[:space:]]([0-9]*).([0-9]*) ]]; then
    HUB_VERSION_MAJOR=${BASH_REMATCH[1]}
    HUB_VERSION_MINOR=${BASH_REMATCH[2]}
    if [[ $HUB_VERSION_MAJOR -lt 2 ]] || [[ $HUB_VERSION_MAJOR -eq 2 && $HUB_VERSION_MINOR -lt 5 ]]; then
        echo "hub version 2.5 is required, you have $HUB_VERSION_MAJOR.$HUB_VERSION_MINOR installed"
        exit
    fi
else
    echo "hub is required: please install it"
    exit
fi
yarn --version > /dev/null || (echo "yarn is required: please install it"; kill $$)

USAGE="$0 [-x] [-c changelog_file] vX.Y.Z"

help() {
    cat <<EOF
$USAGE

    -c changelog_file:  specify name of file containing changelog
    -x:                 skip updating the changelog
EOF
}

if ! git diff-index --quiet --cached HEAD; then
    echo "this git checkout has staged (uncommitted) changes. Refusing to release."
    exit
fi

if ! git diff-files --quiet; then
    echo "this git checkout has uncommitted changes. Refusing to release."
    exit
fi

skip_changelog=
changelog_file="CHANGELOG.md"
while getopts hc:x f; do
    case $f in
        h)
            help
            exit 0
            ;;
        c)
            changelog_file="$OPTARG"
            ;;
        x)
            skip_changelog=1
            ;;
    esac
done
shift $(expr $OPTIND - 1)

if [ $# -ne 1 ]; then
    echo "Usage: $USAGE" >&2
    exit 1
fi

function check_dependency {
    local depver=$(cat package.json | jq -r .dependencies[\"$1\"])
    if [ "$depver" == "null" ]; then return 0; fi

    echo "Checking version of $1..."
    local latestver=$(yarn info -s "$1" dist-tags.next)
    if [ "$depver" != "$latestver" ]
    then
        echo "The latest version of $1 is $latestver but package.json depends on $depver."
        echo -n "Type 'u' to auto-upgrade, 'c' to continue anyway, or 'a' to abort:"
        read resp
        if [ "$resp" != "u" ] && [ "$resp" != "c" ]
        then
            echo "Aborting."
            exit 1
        fi
        if [ "$resp" == "u" ]
        then
            echo "Upgrading $1 to $latestver..."
            yarn add -E "$1@$latestver"
            git add -u
            git commit -m "Upgrade $1 to $latestver"
        fi
    fi
}

function reset_dependency {
    local depver=$(cat package.json | jq -r .dependencies[\"$1\"])
    if [ "$depver" == "null" ]; then return 0; fi

    echo "Resetting $1 to develop branch..."
    yarn add "github:matrix-org/$1#develop"
    git add -u
    git commit -m "Reset $1 back to develop branch"
}

has_subprojects=0
if [ -f release_config.yaml ]; then
    subprojects=$(cat release_config.yaml | python -c "import yaml; import sys; print(' '.join(list(yaml.load(sys.stdin)['subprojects'].keys())))" 2> /dev/null)
    if [ "$?" -eq 0 ]; then
        has_subprojects=1
        echo "Checking subprojects for upgrades"
        for proj in $subprojects; do
            check_dependency "$proj"
        done
    fi
fi

ret=0
cat package.json | jq '.dependencies[]' | grep -q '#develop' || ret=$?
if [ "$ret" -eq 0 ]; then
    echo "package.json contains develop dependencies. Refusing to release."
    exit
fi

# We use Git branch / commit dependencies for some packages, and Yarn seems
# to have a hard time getting that right. See also
# https://github.com/yarnpkg/yarn/issues/4734. As a workaround, we clean the
# global cache here to ensure we get the right thing.
yarn cache clean
# Ensure all dependencies are updated
yarn install --ignore-scripts --frozen-lockfile

# ignore leading v on release
release="${1#v}"
tag="v${release}"

prerelease=0
# We check if this build is a prerelease by looking to
# see if the version has a hyphen in it. Crude,
# but semver doesn't support postreleases so anything
# with a hyphen is a prerelease.
echo $release | grep -q '-' && prerelease=1

if [ $prerelease -eq 1 ]; then
    echo Making a PRE-RELEASE
else
    read -p "Making a FINAL RELEASE, press enter to continue " REPLY
fi

rel_branch=$(git symbolic-ref --short HEAD)

if [ -z "$skip_changelog" ]; then
    echo "Generating changelog"
    yarn run allchange "$release"
    read -p "Edit $changelog_file manually, or press enter to continue " REPLY

    if [ -n "$(git ls-files --modified $changelog_file)" ]; then
        echo "Committing updated changelog"
        git commit "$changelog_file" -m "Prepare changelog for $tag"
    fi
fi
latest_changes=$(mktemp)
cat "${changelog_file}" | "$(dirname "$0")/scripts/changelog_head.py" > "${latest_changes}"

set -x

# Bump package.json and build the dist
echo "yarn version"
# yarn version will automatically commit its modification
# and make a release tag. We don't want it to create the tag
# because it can only sign with the default key, but we can
# only turn off both of these behaviours, so we have to
# manually commit the result.
yarn version --no-git-tag-version --new-version "$release"

# For the published and dist versions of the package, we copy the
# `matrix_lib_main` and `matrix_lib_typings` fields to `main` and `typings` (if
# they exist). This small bit of gymnastics allows us to use the TypeScript
# source directly for development without needing to build before linting or
# testing.
for i in main typings browser
do
    lib_value=$(jq -r ".matrix_lib_$i" package.json)
    if [ "$lib_value" != "null" ]; then
        jq ".$i = .matrix_lib_$i" package.json > package.json.new && mv package.json.new package.json && yarn prettier --write package.json
    fi
done

# commit yarn.lock if it exists, is versioned, and is modified
if [[ -f yarn.lock && $(git status --porcelain yarn.lock | grep '^ M') ]];
then
    pkglock='yarn.lock'
else
    pkglock=''
fi
git commit package.json $pkglock -m "$tag"


# figure out if we should be signing this release
signing_id=
if [ -f release_config.yaml ]; then
    result=$(cat release_config.yaml | python -c "import yaml; import sys; print(yaml.load(sys.stdin)['signing_id'])" 2> /dev/null || true)
    if [ "$?" -eq 0 ]; then
        signing_id=$result
    fi
fi


# If there is a 'dist' script in the package.json,
# run it in a separate checkout of the project, then
# upload any files in the 'dist' directory as release
# assets.
# We make a completely separate checkout to be sure
# we're using released versions of the dependencies
# (rather than whatever we're pulling in from yarn link)
assets=''
dodist=0
jq -e .scripts.dist package.json 2> /dev/null || dodist=$?
if [ $dodist -eq 0 ]; then
    projdir=$(pwd)
    builddir=$(mktemp -d 2>/dev/null || mktemp -d -t 'mytmpdir')
    echo "Building distribution copy in $builddir"
    pushd "$builddir"
    git clone "$projdir" .
    git checkout "$rel_branch"
    yarn install --frozen-lockfile
    # We haven't tagged yet, so tell the dist script what version
    # it's building
    DIST_VERSION="$tag" yarn dist

    popd

    for i in "$builddir"/dist/*; do
        assets="$assets -a $i"
        if [ -n "$signing_id" ]
        then
            gpg -u "$signing_id" --armor --output "$i".asc --detach-sig "$i"
            assets="$assets -a $i.asc"
        fi
    done
fi

if [ -n "$signing_id" ]; then
    # make a signed tag
    # gnupg seems to fail to get the right tty device unless we set it here
    GIT_COMMITTER_EMAIL="$signing_id" GPG_TTY=$(tty) git tag -u "$signing_id" -F "${latest_changes}" "$tag"
else
    git tag -a -F "${latest_changes}" "$tag"
fi

# push the tag and the release branch
git push origin "$rel_branch" "$tag"

if [ -n "$signing_id" ]; then
    # make a signature for the source tarball.
    #
    # github will make us a tarball from the tag - we want to create a
    # signature for it, which means that first of all we need to check that
    # it's correct.
    #
    # we can't deterministically build exactly the same tarball, due to
    # differences in gzip implementation - but we *can* build the same tar - so
    # the easiest way to check the validity of the tarball from git is to unzip
    # it and compare it with our own idea of what the tar should look like.

    # This uses git archive which seems to be what github uses. Specifically,
    # the header fields are set in the same way: same file mode, uid & gid
    # both zero and mtime set to the timestamp of the commit that the tag
    # references. Also note that this puts the commit into the tar headers
    # and can be extracted with gunzip -c foo.tar.gz | git get-tar-commit-id

    # the name of the sig file we want to create
    source_sigfile="${tag}-src.tar.gz.asc"

    tarfile="$tag.tar.gz"
    gh_project_url=$(git remote get-url origin |
                            sed -e 's#^git@github\.com:#https://github.com/#' \
                                -e 's#^git\+ssh://git@github\.com/#https://github.com/#' \
                                -e 's/\.git$//')
    project_name="${gh_project_url##*/}"
    curl -L "${gh_project_url}/archive/${tarfile}" -o "${tarfile}"

    # unzip it and compare it with the tar we would generate
    if ! cmp --silent <(gunzip -c $tarfile) \
         <(git archive --format tar --prefix="${project_name}-${release}/" "$tag"); then

        # we don't bail out here, because really it's more likely that our comparison
        # screwed up and it's super annoying to abort the script at this point.
        cat >&2 <<EOF
!!!!!!!!!!!!!!!!!
!!!! WARNING !!!!

Mismatch between our own tarfile and that generated by github: not signing
source tarball.

To resolve, determine if $tarfile is correct, and if so sign it with gpg and
attach it to the release as $source_sigfile.

!!!!!!!!!!!!!!!!!
EOF
    else
        gpg -u "$signing_id" --armor --output "$source_sigfile" --detach-sig "$tarfile"
        assets="$assets -a $source_sigfile"
    fi
fi

hubflags=''
if [ $prerelease -eq 1 ]; then
    hubflags='-p'
fi

release_text=$(mktemp)
echo "$tag" > "${release_text}"
echo >> "${release_text}"
cat "${latest_changes}" >> "${release_text}"
hub release create $hubflags $assets -F "${release_text}" "$tag"

if [ $dodist -eq 0 ]; then
    rm -rf "$builddir"
fi
rm "${release_text}"
rm "${latest_changes}"

# if it is a pre-release, leave it on the release branch for now.
if [ $prerelease -eq 1 ]; then
    git checkout "$rel_branch"
    exit 0
fi

# merge release branch to master
echo "updating master branch"
git checkout master
git pull
git merge "$rel_branch" --no-edit

# push master to github
git push origin master

# finally, merge master back onto develop (if it exists)
if [ "$(git branch -lr | grep origin/develop -c)" -ge 1 ]; then
    git checkout develop
    git pull
    git merge master --no-edit
    git push origin develop
fi

[ -x ./post-release.sh ] && ./post-release.sh

if [ $has_subprojects -eq 1 ] && [ $prerelease -eq 0 ]; then
    echo "Resetting subprojects to develop"
    for proj in $subprojects; do
        reset_dependency "$proj"
    done
    git push origin develop
fi
