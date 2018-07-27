#!/bin/bash
# run with PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true sh install.sh if chrome is already installed
sh synapse/install.sh
sh riot/install.sh
npm install
