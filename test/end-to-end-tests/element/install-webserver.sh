#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
cd $BASE_DIR
# Install ComplexHttpServer (a drop in replacement for Python's SimpleHttpServer
# but with support for multiple threads) into a virtualenv.
(
    virtualenv -p python3 env
    source env/bin/activate

    pip install --upgrade pip
    pip install --upgrade setuptools

    pip install ComplexHttpServer

    deactivate
)
