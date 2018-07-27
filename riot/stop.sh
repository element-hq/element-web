BASE_DIR=$(realpath $(dirname $0))
cd $BASE_DIR
PIDFILE=riot.pid
kill $(cat $PIDFILE)
rm $PIDFILE
