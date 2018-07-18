RIOT_BRANCH=master
curl -L https://github.com/vector-im/riot-web/archive/${RIOT_BRANCH}.zip --output riot.zip
unzip riot.zip
rm riot.zip
mv riot-web-${RIOT_BRANCH} riot-web
pushd riot-web
npm install
npm run build
