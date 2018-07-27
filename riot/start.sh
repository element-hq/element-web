PORT=8080
echo "running riot on http://localhost:$PORT..."
BASE_DIR=$(realpath $(dirname $0))
pushd $BASE_DIR > /dev/null
pushd riot-web/webapp/ > /dev/null
python -m SimpleHTTPServer $PORT > /dev/null 2>&1 &
PID=$!
popd > /dev/null
echo $PID > riot.pid
popd > /dev/null