#!/bin/bash -l
export NVM_DIR="/home/jenkins/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 4
npm install
(cd node_modules/matrix-react-sdk && npm run build) # npm doesn't do this when dependencies point at github.com >:(
npm run build # Dumps artificats to /vector

# gzip up ./vector
rm vector-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist
REACT_SHA=$(grep 'gitHead' node_modules/matrix-react-sdk/package.json | cut -d \" -f 4 | head -c 12) # node_modules deps from 'npm install' don't have a .git dir so can't rev-parse.
JSSDK_SHA=$(grep 'gitHead' node_modules/matrix-js-sdk/package.json | cut -d \" -f 4 | head -c 12)    # But they do set the commit in package.json under 'gitHead' which we're grabbing here.
VECTOR_SHA=$(git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop
tar -zcvhf vector-$VECTOR_SHA-react-$REACT_SHA-js-$JSSDK_SHA.tar.gz vector #g[z]ip, [c]reate archive, [v]erbose, [f]ilename, [h]ard-dereference (do not archive symlinks)
