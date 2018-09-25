#!/bin/bash
set -e

RIOT_BRANCH=master
BASE_DIR=$(cd $(dirname $0) && pwd)
if [ -d $BASE_DIR/riot-web ]; then
    echo "riot is already installed"
    exit
fi

# Install ComplexHttpServer (a drop in replacement for Python's SimpleHttpServer
# but with support for multiple threads) into a virtualenv.
(
    virtualenv $BASE_DIR/env
    source $BASE_DIR/env/bin/activate

    # Having been bitten by pip SSL fail too many times, I don't trust the existing pip
    # to be able to --upgrade itself, so grab a new one fresh from source.
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python get-pip.py

    pip install ComplexHttpServer

    deactivate
)

cd $BASE_DIR
curl -L https://github.com/vector-im/riot-web/archive/${RIOT_BRANCH}.zip --output riot.zip
unzip -q riot.zip
rm riot.zip
mv riot-web-${RIOT_BRANCH} riot-web
cd riot-web
npm install
npm run build
