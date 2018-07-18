BASE_DIR=$(realpath $(dirname $0))
pushd $BASE_DIR
pushd installations/consent
source env/bin/activate
./synctl start
popd
popd