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

# backup config file before we copy template
if [ -f config.json ]; then
	mv config.json $CONFIG_BACKUP
fi
cp $BASE_DIR/config-template/config.json .

python -m SimpleHTTPServer $PORT > /dev/null 2>&1 &
PID=$!
popd > /dev/null
echo $PID > $PIDFILE
