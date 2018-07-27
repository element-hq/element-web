RIOT_BRANCH=master

BASE_DIR=$(realpath $(dirname $0))
pushd $BASE_DIR
curl -L https://github.com/vector-im/riot-web/archive/${RIOT_BRANCH}.zip --output riot.zip
unzip riot.zip
rm riot.zip
mv riot-web-${RIOT_BRANCH} riot-web
cp config-template/config.json riot-web/
pushd riot-web
npm install
npm run build
popd