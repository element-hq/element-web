#!/bin/bash
set -e
RIOT_BRANCH=develop

if [ -d $BASE_DIR/riot-web ]; then
    echo "riot is already installed"
    exit
fi

curl -L https://github.com/vector-im/riot-web/archive/${RIOT_BRANCH}.zip --output riot.zip
unzip -q riot.zip
rm riot.zip
mv riot-web-${RIOT_BRANCH} riot-web
cd riot-web
yarn install
yarn run build
