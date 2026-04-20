#!/bin/bash

set -e

echo "Starting Xvfb"
Xvfb :99 -ac &
sleep 2

export DISPLAY=:99

PLAYWRIGHT_HTML_OPEN=never CI=1 ELEMENT_DESKTOP_EXECUTABLE="./dist/linux-unpacked/element-desktop" \
  exec pnpm -C apps/desktop exec playwright test --update-snapshots --reporter line,html "$1"
