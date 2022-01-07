#!/bin/bash
#
# Script to perform a release of matrix-js-sdk and downstream projects.
#
# Requires:
#   github-changelog-generator; install via:
#     pip install git+https://github.com/matrix-org/github-changelog-generator.git
#   jq; install from your distribution's package manager (https://stedolan.github.io/jq/)
#   hub; install via brew (macOS) or source/pre-compiled binaries (debian) (https://github.com/github/hub) - Tested on v2.2.9
#   npm; typically installed by Node.js
#   yarn; install via brew (macOS) or similar (https://yarnpkg.com/docs/install/)
#
# Note: this script is also used to release matrix-react-sdk and element-web.

set -e

jq --version > /dev/null || (echo "jq is required: please install it"; kill $$)
if [[ `command -v hub` ]] && [[ `hub --version` =~ hub[[:space:]]version[[:space:]]([0-9]*).([0-9]*) ]]; then
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
npm --version > /dev/null || (echo "npm is required: please install it"; kill $$)
yarn --version > /dev/null || (echo "yarn is required: please install it"; kill $$)

USAGE="$0 [-xz] [-c changelog_file] vX.Y.Z"

help() {
    cat <<EOF
$USAGE

    -c changelog_file:  specify name of file containing changelog
    -x:                 skip updating the changelog
    -z:                 skip generating the jsdoc
    -n:                 skip publish to NPM
EOF
}

ret=0
cat package.json | jq '.dependencies[]' | grep -q '#develop' || ret=$?
if [ "$ret" -eq 0 ]; then
    echo "package.json contains develop dependencies. Refusing to release."
    exit
fi

if ! git diff-index --quiet --cached HEAD; then
    echo "this git checkout has staged (uncommitted) changes. Refusing to release."
    exit
fi

if ! git diff-files --quiet; then
    echo "this git checkout has uncommitted changes. Refusing to release."
    exit
fi

skip_changelog=
skip_jsdoc=
skip_npm=
changelog_file="CHANGELOG.md"
expected_npm_user="matrixdotorg"
while getopts hc:u:xzn f; do
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
        z)
            skip_jsdoc=1
            ;;
        n)
            skip_npm=1
            ;;
        u)
            expected_npm_user="$OPTARG"
            ;;
    esac
done
shift `expr $OPTIND - 1`

if [ $# -ne 1 ]; then
    echo "Usage: $USAGE" >&2
    exit 1
fi

# We use Git branch / commit dependencies for some packages, and Yarn seems
# to have a hard time getting that right. See also
# https://github.com/yarnpkg/yarn/issues/4734. As a workaround, we clean the
# global cache here to ensure we get the right thing.
yarn cache clean
# Ensure all dependencies are updated
yarn install --ignore-scripts --pure-lockfile

# Login and publish continues to use `npm`, as it seems to have more clearly
# defined options and semantics than `yarn` for writing to the registry.
if [ -z "$skip_npm" ]; then
    actual_npm_user=`npm whoami`;
    if [ $expected_npm_user != $actual_npm_user ]; then
        echo "you need to be logged into npm as $expected_npm_user, but you are logged in as $actual_npm_user" >&2
        exit 1
    fi
fi

# ignore leading v on release
release="${1#v}"
tag="v${release}"
rel_branch="release-$tag"

prerelease=0
# We check if this build is a prerelease by looking to
# see if the version has a hyphen in it. Crude,
# but semver doesn't support postreleases so anything
# with a hyphen is a prerelease.
echo $release | grep -q '-' && prerelease=1

if [ $prerelease -eq 1 ]; then
    echo Making a PRE-RELEASE
fi

# we might already be on the release branch, in which case, yay
# If we're on any branch starting with 'release', we don't create
# a separate release branch (this allows us to use the same
# release branch for releases and release candidates).
curbranch=$(git symbolic-ref --short HEAD)
if [[ "$curbranch" != release* ]]; then
    echo "Creating release branch"
    git checkout -b "$rel_branch"
else
    echo "Using current branch ($curbranch) for release"
    rel_branch=$curbranch
fi

if [ -z "$skip_changelog" ]; then
    echo "Generating changelog"
    yarn run allchange "$release"
    read -p "Edit $changelog_file manually, or press enter to continue " REPLY

    if [ -n "$(git ls-files --modified $changelog_file)" ]; then
        echo "Committing updated changelog"
        git commit "$changelog_file" -m "Prepare changelog for $tag"
    fi
fi
latest_changes=`mktemp`
cat "${changelog_file}" | `dirname $0`/scripts/changelog_head.py > "${latest_changes}"

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
for i in main typings
do
    lib_value=$(jq -r ".matrix_lib_$i" package.json)
    if [ "$lib_value" != "null" ]; then
        jq ".$i = .matrix_lib_$i" package.json > package.json.new && mv package.json.new package.json
    fi
done

# commit yarn.lock if it exists, is versioned, and is modified
if [[ -f yarn.lock && `git status --porcelain yarn.lock | grep '^ M'` ]];
then
    pkglock='yarn.lock'
else
    pkglock=''
fi
git commit package.json $pkglock -m "$tag"


# figure out if we should be signing this release
signing_id=
if [ -f release_config.yaml ]; then
    result=`cat release_config.yaml | python -c "import yaml; import sys; print yaml.load(sys.stdin)['signing_id']" 2> /dev/null || true`
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
    projdir=`pwd`
    builddir=`mktemp -d 2>/dev/null || mktemp -d -t 'mytmpdir'`
    echo "Building distribution copy in $builddir"
    pushd "$builddir"
    git clone "$projdir" .
    git checkout "$rel_branch"
    yarn install --pure-lockfile
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
    GIT_COMMITTER_EMAIL="$signing_id" GPG_TTY=`tty` git tag -u "$signing_id" -F "${latest_changes}" "$tag"
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

release_text=`mktemp`
echo "$tag" > "${release_text}"
echo >> "${release_text}"
cat "${latest_changes}" >> "${release_text}"
hub release create $hubflags $assets -F "${release_text}" "$tag"

if [ $dodist -eq 0 ]; then
    rm -rf "$builddir"
fi
rm "${release_text}"
rm "${latest_changes}"

# Login and publish continues to use `npm`, as it seems to have more clearly
# defined options and semantics than `yarn` for writing to the registry.
# Tag both releases and prereleases as `next` so the last stable release remains
# the default.
if [ -z "$skip_npm" ]; then
    npm publish --tag next
    if [ $prerelease -eq 0 ]; then
        # For a release, also add the default `latest` tag.
        package=$(cat package.json | jq -er .name)
        npm dist-tag add "$package@$release" latest
    fi
fi

if [ -z "$skip_jsdoc" ]; then
    echo "generating jsdocs"
    yarn gendoc

    echo "copying jsdocs to gh-pages branch"
    git checkout gh-pages
    git pull
    cp -a ".jsdoc/matrix-js-sdk/$release" .
    perl -i -pe 'BEGIN {$rel=shift} $_ =~ /^<\/ul>/ && print
        "<li><a href=\"${rel}/index.html\">Version ${rel}</a></li>\n"' \
        $release index.html
    git add "$release"
    git commit --no-verify -m "Add jsdoc for $release" index.html "$release"
    git push origin gh-pages
fi

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
if [ $(git branch -lr | grep origin/develop -c) -ge 1 ]; then
    git checkout develop
    git pull
    git merge master --no-edit

    # When merging to develop, we need revert the `main` and `typings` fields if
    # we adjusted them previously.
    for i in main typings
    do
        # If a `lib` prefixed value is present, it means we adjusted the field
        # earlier at publish time, so we should revert it now.
        if [ "$(jq -r ".matrix_lib_$i" package.json)" != "null" ]; then
            # If there's a `src` prefixed value, use that, otherwise delete.
            # This is used to delete the `typings` field and reset `main` back
            # to the TypeScript source.
            src_value=$(jq -r ".matrix_src_$i" package.json)
            if [ "$src_value" != "null" ]; then
                jq ".$i = .matrix_src_$i" package.json > package.json.new && mv package.json.new package.json
            else
                jq "del(.$i)" package.json > package.json.new && mv package.json.new package.json
            fi
        fi
    done

    if [ -n "$(git ls-files --modified package.json)" ]; then
        echo "Committing develop package.json"
        git commit package.json -m "Resetting package fields for development"
    fi

    git push origin develop
fi
