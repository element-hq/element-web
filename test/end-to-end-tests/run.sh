#!/bin/bash
set -e

stop_servers() {
	./riot/stop.sh
	./synapse/stop.sh
}

handle_error() {
	EXIT_CODE=$?
	stop_servers
	exit $EXIT_CODE
}

trap 'handle_error' ERR

./synapse/start.sh
./riot/start.sh
node start.js $@
stop_servers
