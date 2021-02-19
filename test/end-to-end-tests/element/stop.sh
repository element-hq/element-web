#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
PIDFILE=element.pid
CONFIG_BACKUP=config.e2etests_backup.json

cd $BASE_DIR

if [ -f $PIDFILE ]; then
    echo "Stopping Element server ..."
    PID=$(cat $PIDFILE)
    rm $PIDFILE
    kill $PID

    # revert config file
    cd element-web/webapp
    rm config.json
    if [ -f $CONFIG_BACKUP ]; then
        mv $CONFIG_BACKUP config.json
    fi
fi
