#!/bin/bash
# run with PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true sh install.sh if chrome is already installed
set -e
./synapse/install.sh
# local testing doesn't need a Element fetched from master,
# so not installing that by default
yarn install
