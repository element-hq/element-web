PIDFILE=riot.pid
kill $(cat $PIDFILE)
rm $PIDFILE