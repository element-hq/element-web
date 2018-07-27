BASE_DIR=$(readlink -f $(dirname $0))
cd $BASE_DIR
PIDFILE=riot.pid
kill $(cat $PIDFILE)
rm $PIDFILE
