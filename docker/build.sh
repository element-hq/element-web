#!/bin/sh

# Get Riot
wget https://github.com/vector-im/riot-web/releases/download/v$1/riot-v$1.tar.gz;
tar axf riot-v$1.tar.gz;
rm -f riot-v$1.tar.gz;
mv riot-v$1 riot;

# Add custom config, if existing
if [ -f ./config.json ] ; then
	cp ./config.json riot/config.json
fi

# Build image
docker build . -t riot:latest;

# clean directory
rm -rf riot;
