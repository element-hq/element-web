#!/bin/bash

set -e

yarn --cwd ../element-web install
npx playwright test --update-snapshots --reporter line --project='Legacy Crypto' $1
