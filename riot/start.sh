BASE_DIR=$(realpath $(dirname $0))
pushd $BASE_DIR
pushd riot-web/webapp/
python -m SimpleHTTPServer 8080 &
PID=$!
popd
echo $PID > riot.pid
popd