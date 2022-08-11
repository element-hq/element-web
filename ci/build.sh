#!/bin/bash
set -euxo pipefail

echo 'running build.sh file from jenkins'
yarn install
yarn build
