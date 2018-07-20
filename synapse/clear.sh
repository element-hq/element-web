BASE_DIR=$(realpath $(dirname $0))
pushd $BASE_DIR
pushd installations/consent
rm homeserver.db
popd
popd