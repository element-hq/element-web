#!/bin/bash
PORT=5000
BASE_DIR=$(readlink -f $(dirname $0))
PIDFILE=riot.pid
CONFIG_BACKUP=config.e2etests_backup.json

cd $BASE_DIR/

if [ -f $PIDFILE ]; then
	exit
fi

echo "running riot on http://localhost:$PORT ..."
pushd riot-web/webapp/ > /dev/null
python -m SimpleHTTPServer $PORT > /dev/null 2>&1 &
PID=$!
popd > /dev/null
echo $PID > $PIDFILE
