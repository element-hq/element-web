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

    # Pin setuptools to work around crash bug in v60
    # See https://github.com/vector-im/element-web/issues/20287
    pip install setuptools==v59.8.0

    pip install ComplexHttpServer

    deactivate
)
