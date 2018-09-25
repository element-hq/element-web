#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
PIDFILE=riot.pid
CONFIG_BACKUP=config.e2etests_backup.json

cd $BASE_DIR

if [ -f $PIDFILE ]; then
    echo "stopping riot server ..."
    PID=$(cat $PIDFILE)
    rm $PIDFILE
    kill $PID

    # revert config file
    cd riot-web/webapp
    rm config.json
    if [ -f $CONFIG_BACKUP ]; then
        mv $CONFIG_BACKUP config.json
    fi
fi
