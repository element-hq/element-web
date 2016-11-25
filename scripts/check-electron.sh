#!/bin/sh

update_url=`jq .update_url webapp/config.json`
echo "***************************************************"
echo
if [ $? = 0 ]; then
    echo "Built electron package with update url: $update_url"
else
    echo "Built electron package with no update url"
    echo "This build will not auto-update."
fi
echo
echo "***************************************************"
