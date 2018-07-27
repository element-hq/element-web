RIOT_BRANCH=master

BASE_DIR=$(realpath $(dirname $0))
if [[ -d $BASE_DIR/riot-web ]]; then
	echo "riot is already installed"
	exit
fi


pushd $BASE_DIR > /dev/null
curl -L https://github.com/vector-im/riot-web/archive/${RIOT_BRANCH}.zip --output riot.zip
unzip riot.zip
rm riot.zip
mv riot-web-${RIOT_BRANCH} riot-web
cp config-template/config.json riot-web/
pushd riot-web > /dev/null
npm install
npm run build
popd > /dev/null
popd > /dev/null
