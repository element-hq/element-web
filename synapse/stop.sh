BASE_DIR=$(realpath $(dirname $0))
cd $BASE_DIR
cd installations/consent
source env/bin/activate
./synctl stop
