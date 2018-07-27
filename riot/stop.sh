#!/bin/bash
BASE_DIR=$(readlink -f $(dirname $0))
cd $BASE_DIR
PIDFILE=riot.pid
if [ -f $PIDFILE ]; then
	echo "stopping riot server ..."
	kill $(cat $PIDFILE)
	rm $PIDFILE
fi
