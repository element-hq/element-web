#!/bin/bash
BASE_DIR=$(readlink -f $(dirname $0))
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