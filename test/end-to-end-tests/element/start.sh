#!/usr/bin/env bash
set -e

PORT=5000
BASE_DIR=$(cd $(dirname $0) && pwd)
PIDFILE=$BASE_DIR/element.pid
CONFIG_BACKUP=config.e2etests_backup.json

if [ -f $PIDFILE ]; then
    exit
fi

cd $BASE_DIR/
echo -n "Starting Element on http://localhost:$PORT ... "
pushd element-web/webapp/ > /dev/null

# backup config file before we copy template
if [ -f config.json ]; then
    mv config.json $CONFIG_BACKUP
fi
cp $BASE_DIR/config-template/config.json .

LOGFILE=$(mktemp)
# run web server in the background, showing output on error
(
    source $BASE_DIR/env/bin/activate
    python -m ComplexHTTPServer $PORT > $LOGFILE 2>&1 &
    PID=$!
    echo $PID > $PIDFILE
    # wait so subshell does not exit
    # otherwise sleep below would not work
    wait $PID; RESULT=$?

    # NOT expected SIGTERM (128 + 15)
    # from stop.sh?
    if [ $RESULT -ne 143 ]; then
        echo "Failed"
        cat $LOGFILE
        rm $PIDFILE 2> /dev/null
    fi
    rm $LOGFILE
    exit $RESULT
)&
# to be able to return the exit code for immediate errors (like address already in use)
# we wait for a short amount of time in the background and exit when the first
# child process exits
sleep 0.5 &
# wait the first child process to exit (python or sleep)
wait -n; RESULT=$?
# return exit code of first child to exit
if [ $RESULT -eq 0 ]; then
    echo "Running"
fi
exit $RESULT
