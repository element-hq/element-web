#!/bin/sh
#
# script to clean up the deployments made by redeploy.py for vectorwebdev and vectorwebexp
set -e

# currently live deployment (full path)
live=`dirname $(readlink -f "$HOME/live")`

# currently live bundle (just the name of the bundle)
live_bundle=`grep 'script src="bundles' live/index.html | sed -e 's#.*bundles/##' -e 's#/.*##'`

# clean up 'extracted': find things which are older than 7 days, exclude the current live one, and remove
find $HOME/extracted -maxdepth 1 -type d -ctime +7 \! -path "$live" -exec rm -r {} \;

# clean up 'bundles': ditto
find $HOME/bundles -maxdepth 1 -type d -ctime +7 \! -name "$live_bundle" -exec rm -r {} \;
