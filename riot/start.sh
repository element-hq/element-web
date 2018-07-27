#!/bin/bash
PORT=5000
echo "running riot on http://localhost:$PORT..."
BASE_DIR=$(readlink -f $(dirname $0))
cd $BASE_DIR/
pushd riot-web/webapp/ > /dev/null
python -m SimpleHTTPServer $PORT > /dev/null 2>&1 &
PID=$!
popd > /dev/null
echo $PID > riot.pid
