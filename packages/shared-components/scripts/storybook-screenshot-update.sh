#!/bin/bash

# Storybook screenshot update script
# This script should be used as the entrypoint parameter of the playwright-screenshots script.
# See https://github.com/element-hq/element-modules/tree/main/packages/element-web-playwright-common
# Example: playwright-screenshots --entrypoint /work/scripts/storybook-screenshot-update.sh --with-node-modules
# (playwright-screenshots can be run once every 50sec because it's using ryuk to clean up containers.)
#
# It updates the storybook screenshots for the storybook instance running at http://host.docker.internal:6007/.

set -e

# First install dependencies.
# Be sure to use --with-node-modules on playwright-screenshots to avoid issues with native modules.
yarn

# Now run the screenshot update
/work/node_modules/.bin/test-storybook --url http://host.docker.internal:6007/ --updateSnapshot
