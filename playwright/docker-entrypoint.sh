#!/bin/bash

set -e

yarn link
yarn --cwd ../element-web install
yarn --cwd ../element-web link matrix-react-sdk
npx playwright test --update-snapshots --reporter line --project='Legacy Crypto' $@
