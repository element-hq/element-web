#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
pushd $BASE_DIR

if [ ! -d "synapse/installations" ] || [ ! -d "node_modules" ]; then
echo "Please first run $BASE_DIR/install.sh"
    exit 1
fi

has_custom_app=$(node has-custom-app.js $@)

if [ ! -d "element/element-web" ] && [ $has_custom_app -ne "1" ]; then
    echo "Please provide an instance of Element to test against by passing --element-url <url> or running $BASE_DIR/element/install.sh"
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
	stop_servers
	exit $EXIT_CODE
}

trap 'handle_error' ERR

./synapse/start.sh
if [ $has_custom_app -ne "1" ]; then
    ./element/start.sh
fi
node start.js $@
stop_servers
