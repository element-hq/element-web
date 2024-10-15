#!/bin/bash

set -e

npx playwright test --update-snapshots --reporter line $@
