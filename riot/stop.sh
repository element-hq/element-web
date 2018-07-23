BASE_DIR=$(realpath $(dirname $0))
pushd $BASE_DIR > /dev/null
PIDFILE=riot.pid
kill $(cat $PIDFILE)
rm $PIDFILE
popd > /dev/null