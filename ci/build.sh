#!/usr/bin/env bash
set -euxo pipefail

echo 'running build.sh file from jenkins'
yarn build
