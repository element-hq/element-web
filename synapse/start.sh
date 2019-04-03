#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
cd $BASE_DIR
cd installations/consent
source env/bin/activate
LOGFILE=$(mktemp)
./synctl start 2> $LOGFILE
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
	cat $LOGFILE
fi
exit $EXIT_CODE
