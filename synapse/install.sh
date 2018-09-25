#!/bin/bash
set -e

# config
SYNAPSE_BRANCH=develop
INSTALLATION_NAME=consent
SERVER_DIR=installations/$INSTALLATION_NAME
CONFIG_TEMPLATE=consent
PORT=5005
# set current directory to script directory
BASE_DIR=$(cd $(dirname $0) && pwd)

if [ -d $BASE_DIR/$SERVER_DIR ]; then
    echo "synapse is already installed"
    exit
fi

cd $BASE_DIR

mkdir -p installations/
curl https://codeload.github.com/matrix-org/synapse/zip/$SYNAPSE_BRANCH --output synapse.zip
unzip -q synapse.zip
mv synapse-$SYNAPSE_BRANCH $SERVER_DIR
cd $SERVER_DIR
virtualenv -p python2.7 env
source env/bin/activate

# Having been bitten by pip SSL fail too many times, I don't trust the existing pip
# to be able to --upgrade itself, so grab a new one fresh from source.
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python get-pip.py

pip install --upgrade setuptools
python synapse/python_dependencies.py | xargs pip install
pip install lxml mock
pip install .

python -m synapse.app.homeserver \
    --server-name localhost \
    --config-path homeserver.yaml \
    --generate-config \
    --report-stats=no
# apply configuration
cp -r $BASE_DIR/config-templates/$CONFIG_TEMPLATE/. ./

# Hashes used instead of slashes because we'll get a value back from $(pwd) that'll be
# full of un-escapable slashes.
sed -i '' "s#{{SYNAPSE_ROOT}}#$(pwd)/#g" homeserver.yaml
sed -i '' "s#{{SYNAPSE_PORT}}#${PORT}#g" homeserver.yaml
sed -i '' "s#{{FORM_SECRET}}#$(uuidgen)#g" homeserver.yaml
sed -i '' "s#{{REGISTRATION_SHARED_SECRET}}#$(uuidgen)#g" homeserver.yaml
sed -i '' "s#{{MACAROON_SECRET_KEY}}#$(uuidgen)#g" homeserver.yaml
