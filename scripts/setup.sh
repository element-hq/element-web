#!/bin/bash

# read installation path
echo -n  "Installation path: "
read instPath
eval cd $instPath

# matrix js sdk
git clone https://github.com/matrix-org/matrix-js-sdk.git
pushd matrix-js-sdk
git checkout develop 
npm install
npm install source-map-loader
popd


# matrix react sdk
git clone https://github.com/matrix-org/matrix-react-sdk.git 
pushd matrix-react-sdk
git checkout develop 
npm install
rm -r node_modules/matrix-js-sdk; ln -s ../../matrix-js-sdk node_modules/
popd


# riot-web
git clone https://github.com/vector-im/riot-web.git 
cd riot-web
git checkout develop 
npm install
rm -r node_modules/matrix-js-sdk; ln -s ../../matrix-js-sdk node_modules/
rm -r node_modules/matrix-react-sdk; ln -s ../../matrix-react-sdk node_modules/
npm start
