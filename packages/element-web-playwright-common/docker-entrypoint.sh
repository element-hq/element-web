#!/bin/bash

set -e

if [[ "$YARN_INSTALL" == "true" ]]; then
  yarn install --frozen-lockfile
fi

npx playwright test --update-snapshots --reporter line "$@"