#!/bin/bash
# config
SYNAPSE_BRANCH=master
INSTALLATION_NAME=consent
SERVER_DIR=installations/$INSTALLATION_NAME
CONFIG_TEMPLATE=consent
PORT=5005
# set current directory to script directory
BASE_DIR=$(readlink -f $(dirname $0))

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
pip install --upgrade pip
pip install --upgrade setuptools
pip install .
python -m synapse.app.homeserver \
    --server-name localhost \
    --config-path homeserver.yaml \
    --generate-config \
    --report-stats=no
# apply configuration
cp -r $BASE_DIR/config-templates/$CONFIG_TEMPLATE/. ./
sed -i "s#{{SYNAPSE_ROOT}}#$(pwd)/#g" homeserver.yaml
sed -i "s#{{SYNAPSE_PORT}}#${PORT}#g" homeserver.yaml
sed -i "s#{{FORM_SECRET}}#$(uuidgen)#g" homeserver.yaml
sed -i "s#{{REGISTRATION_SHARED_SECRET}}#$(uuidgen)#g" homeserver.yaml
sed -i "s#{{MACAROON_SECRET_KEY}}#$(uuidgen)#g" homeserver.yaml
