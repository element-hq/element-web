#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
pushd $BASE_DIR

if [ ! -d "synapse/installations" ] || [ ! -d "node_modules" ]; then
echo "Please first run $BASE_DIR/install.sh"
    exit 1
fi

has_custom_riot=$(node has_custom_riot.js $@)

if [ ! -d "riot/riot-web" ] && [ $has_custom_riot -ne "1" ]; then
    echo "Please provide an instance of riot to test against by passing --riot-url <url> or running $BASE_DIR/riot/install.sh"
    exit 1
fi

stop_servers() {
    if [ $has_custom_riot -ne "1" ]; then
	   ./riot/stop.sh
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
if [ $has_custom_riot -ne "1" ]; then
    ./riot/start.sh
fi
node start.js $@
stop_servers
