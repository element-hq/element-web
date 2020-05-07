#!/bin/bash
echo "# Random Comment" >> update.sh

git commit -am 'updated update file'
git pull main develop
git push
