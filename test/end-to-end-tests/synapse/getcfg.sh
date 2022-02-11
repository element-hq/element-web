#!/bin/bash
set -e

if [ $# -eq 0 ]
then
    echo "Prints a configuration directive from the synapse installation"
    echo "Usage: getcfg.sh <synapse config file directive>"
    exit 1
fi

# activate the virtualenv so we have pyyaml
BASE_DIR=$(cd $(dirname $0) && pwd)
cd $BASE_DIR
cd installations/consent/env/bin/
source activate

python -c "from yaml import load, Loader; import sys; print(load(sys.stdin, Loader=Loader)['$1'])" < homeserver.yaml
