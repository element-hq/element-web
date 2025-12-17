#!/bin/bash
#
# Update storybook screenshots
#
# This script should be used as the entrypoint parameter of the `playwright-screenshots` script. It
# installs the yarn dependencies, and then runs `test-storybook` to update the storybook screenshots.
#
# It expects to find a storybook instance running at :6007 on the host machine. It also requires that
# `playwright-screenshots` is given the `--with-node-modules` parameter.
#
# Example:
#
#        test-storybook --url http://localhost:6007/
#        playwright-screenshots --entrypoint /work/scripts/storybook-screenshot-update.sh --with-node-modules
#
#
# Note: even though this script is small, it is important because the alternative is running
# `playwright-screenshots` twice in quick succession (once to do `yarn install`, a second to do the
# actual updates): and that fails, because running `playwright-screenshots` without actually starting
# Testcontainers leaves a ryuk container hanging around for up to 60s, which will block the second
# invocation.

set -e

# First install dependencies. We have to do this within the playwright container rather than the host,
# because we have which must be built for the right architecture (and some environments use a VM
# to run docker containers, meaning that things inside a container use a different architecture than
# those on the host).
yarn

# Now run the screenshot update
/work/node_modules/.bin/test-storybook --url http://host.docker.internal:6007/ --updateSnapshot
