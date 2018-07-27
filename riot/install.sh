RIOT_BRANCH=master

BASE_DIR=$(readlink -f $(dirname $0))
if [[ -d $BASE_DIR/riot-web ]]; then
	echo "riot is already installed"
	exit
fi

cd $BASE_DIR
curl -L https://github.com/vector-im/riot-web/archive/${RIOT_BRANCH}.zip --output riot.zip
unzip riot.zip
rm riot.zip
mv riot-web-${RIOT_BRANCH} riot-web
cp config-template/config.json riot-web/
cd riot-web
npm install
npm run build
