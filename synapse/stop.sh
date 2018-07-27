BASE_DIR=$(realpath $(dirname $0))
pushd $BASE_DIR > /dev/null
pushd installations/consent > /dev/null
source env/bin/activate
./synctl stop
popd > /dev/null
popd > /dev/null