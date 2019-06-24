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
mkdir -p $SERVER_DIR
cd $SERVER_DIR
virtualenv -p python3 env
source env/bin/activate

# Having been bitten by pip SSL fail too many times, I don't trust the existing pip
# to be able to --upgrade itself, so grab a new one fresh from source.
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python get-pip.py

pip install --upgrade setuptools
pip install https://codeload.github.com/matrix-org/synapse/zip/$SYNAPSE_BRANCH
# apply configuration
pushd env/bin/
cp -r $BASE_DIR/config-templates/$CONFIG_TEMPLATE/. ./

# Hashes used instead of slashes because we'll get a value back from $(pwd) that'll be
# full of un-escapable slashes.
# Use .bak suffix as using no suffix doesn't work macOS.
sed -i.bak "s#{{SYNAPSE_ROOT}}#$(pwd)/#g" homeserver.yaml
sed -i.bak "s#{{SYNAPSE_PORT}}#${PORT}#g" homeserver.yaml
sed -i.bak "s#{{FORM_SECRET}}#$(uuidgen)#g" homeserver.yaml
sed -i.bak "s#{{REGISTRATION_SHARED_SECRET}}#$(uuidgen)#g" homeserver.yaml
sed -i.bak "s#{{MACAROON_SECRET_KEY}}#$(uuidgen)#g" homeserver.yaml
rm *.bak

popd
# generate signing keys for signing_key_path
python -m synapse.app.homeserver --generate-keys --config-dir env/bin/ -c env/bin/homeserver.yaml
