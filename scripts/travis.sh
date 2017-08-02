#!/bin/sh

set -ex

npm run test
./.travis-test-riot.sh

# run the linter, but exclude any files known to have errors or warnings.
./node_modules/.bin/eslint --max-warnings 0 \
    --ignore-path .eslintignore.errorfiles \
    src test
