BASE_DIR=$(realpath $(dirname $0))
pushd $BASE_DIR > /dev/null
pushd installations/consent > /dev/null
source env/bin/activate
./synctl start 2> /dev/null
popd > /dev/null
popd > /dev/null