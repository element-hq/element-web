#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
cd $BASE_DIR
# Install ComplexHttpServer (a drop in replacement for Python's SimpleHttpServer
# but with support for multiple threads) into a virtualenv.
(
    virtualenv -p python3 env
    source env/bin/activate

    # Having been bitten by pip SSL fail too many times, I don't trust the existing pip
    # to be able to --upgrade itself, so grab a new one fresh from source.
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python get-pip.py
    rm get-pip.py

    pip install ComplexHttpServer

    deactivate
)
