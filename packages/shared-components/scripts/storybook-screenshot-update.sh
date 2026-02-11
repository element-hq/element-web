#!/bin/bash
#
# Update storybook screenshots
#
# This script should be used as the entrypoint parameter of the `playwright-screenshots` script. It
# installs the pnpm dependencies, and then runs `vitest --run --update --project=storybook` to update the storybook screenshots.
#
# It requires that `playwright-screenshots` is given the `--with-node-modules` parameter.

set -e

# First install dependencies. We have to do this within the playwright container rather than the host,
# because we have which must be built for the right architecture (and some environments use a VM
# to run docker containers, meaning that things inside a container use a different architecture than
# those on the host).
pnpm install

# Now run the screenshot update, we set CI=1 to inform vis to update the real baselines
CI=1 /work/node_modules/.bin/vitest --run --update --project=storybook "$@"
