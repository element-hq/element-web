#!/usr/bin/env bash

set -e

# If $1 looks like v1.2.3 or v1.2.3-foo, strip the leading v, then print it to stdout
if [[ $1 =~ ^v[[:digit:]]+\.[[:digit:]]+\.[[:digit:]]+(-.+)?$ ]]; then
    echo ${1:1}
else
    echo $1
fi
