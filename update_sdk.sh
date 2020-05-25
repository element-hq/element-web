#!/bin/bash
cd ../matrix-react-sdk;
git pull main develop;
git push;

cd -;

echo "# Random Comment" >> update.sh
git commit -am 'updated update file'

git pull main develop
git push
