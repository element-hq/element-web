#!/bin/sh

# get riot
wget https://github.com/vector-im/riot-web/releases/download/v$1/riot-v$1.tar.gz;
tar axf riot-v$1.tar.gz;
rm -f riot-v$1.tar.gz;
mv riot-v$1 riot;

# Build image
docker build . -t riot:latest;

# clean directory
rm -rf riot;
