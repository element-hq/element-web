#!/bin/bash

set -e

HEADED=1 xvfb-run npx playwright test --update-snapshots --reporter line $@
