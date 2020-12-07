#!/bin/bash
set -e
ELEMENT_BRANCH=develop

if [ -d $BASE_DIR/element-web ]; then
    echo "Element is already installed"
    exit
fi

curl -L https://github.com/vector-im/element-web/archive/${ELEMENT_BRANCH}.zip --output element.zip
unzip -q element.zip
rm element.zip
mv element-web-${ELEMENT_BRANCH} element-web
cd element-web
yarn install
yarn run build
