#!/bin/bash
set -euxo pipefail

echo 'running build.sh file from jenkins'
export NODE_OPTIONS=--openssl-legacy-provider
yarn test
