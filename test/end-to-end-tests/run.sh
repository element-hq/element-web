#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
pushd $BASE_DIR
has_custom_riot=$(node has_custom_riot.js $@)

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
