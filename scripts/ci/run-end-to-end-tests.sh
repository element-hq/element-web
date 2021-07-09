#!/bin/bash

set -ev

handle_error() {
    EXIT_CODE=$?
    exit $EXIT_CODE
}

trap 'handle_error' ERR

# run end to end tests
pushd test/end-to-end-tests
rm -r logs || true
mkdir logs
echo "--- Running end-to-end tests"
TESTS_STARTED=1
./run.sh --no-sandbox --log-directory logs/
popd
