BASE_DIR=$(realpath $(dirname $0))
pushd $BASE_DIR
PIDFILE=riot.pid
kill $(cat $PIDFILE)
rm $PIDFILE
popd