#!/bin/bash

if [[ ! -f "./webapp" ]]; then
  mkdir "./webapp"
fi

curl -s https://jitsi.riot.im/libs/external_api.min.js > ./webapp/jitsi_external_api.min.js
