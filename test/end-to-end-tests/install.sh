#!/bin/bash
# run with PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true sh install.sh if chrome is already installed
set -e
./synapse/install.sh
# both CI and local testing don't need a Riot fetched from master,
# so not installing this by default anymore
# ./riot/install.sh
yarn install
