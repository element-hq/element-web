#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
cd $BASE_DIR
cd installations/consent/env/bin/
source activate
LOGFILE=$(mktemp)
echo "Synapse log file at $LOGFILE"
./synctl start 2> $LOGFILE
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
	cat $LOGFILE
fi
exit $EXIT_CODE
