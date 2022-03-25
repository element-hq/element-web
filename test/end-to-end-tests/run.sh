#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
pushd $BASE_DIR

if [ ! -d "synapse/installations" ] || [ ! -d "node_modules" ]; then
echo "Please first run $BASE_DIR/install.sh"
    exit 1
fi

has_custom_app=$(node has-custom-app.js $@)
synapse_log_file=$(node pick-synapse-log-file.js $@)
touch $synapse_log_file

if [ ! -d "element/element-web" ] && [ $has_custom_app -ne "1" ]; then
    echo "Please provide an instance of Element to test against by passing --app-url <url> or running $BASE_DIR/element/install.sh"
    exit 1
fi

stop_servers() {
    if [ $has_custom_app -ne "1" ]; then
	   ./element/stop.sh
	fi
    ./synapse/stop.sh
}

handle_error() {
	EXIT_CODE=$?
	echo "Tests fell over with a non-zero exit code: stopping servers"
	stop_servers
	exit $EXIT_CODE
}

trap 'handle_error' ERR

LOGFILE=$synapse_log_file ./synapse/start.sh
reg_secret=`./synapse/getcfg.sh registration_shared_secret`
if [ $has_custom_app -ne "1" ]; then
    ./element/start.sh
fi
yarn build
node lib/start.js --registration-shared-secret=$reg_secret $@
stop_servers
