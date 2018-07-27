#!/bin/bash
# run with PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true sh install.sh if chrome is already installed
set -e
./synapse/install.sh
./riot/install.sh
npm install
