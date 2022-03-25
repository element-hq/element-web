#!/bin/bash
set -e

BASE_DIR=$(cd $(dirname $0) && pwd)
cd $BASE_DIR
cd installations/consent/env/bin/
source activate
echo "Synapse log file at $LOGFILE"
./synctl start 2> $LOGFILE
