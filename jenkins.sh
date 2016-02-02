#!/bin/bash -l
export NVM_DIR="/home/jenkins/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 4
npm install
(cd node_modules/matrix-react-sdk && npm run build) # npm doesn't do this when dependencies point at github.com >:(
npm run build # Dumps artificats to /vector
rm vector-build.tar.gz || true # rm previous artifacts without failing if it doesn't exist
tar -zcvhf vector-build.tar.gz vector #g[z]ip, [c]reate archive, [v]erbose, [f]ilename, [h]ard-dereference (do not archive symlinks)
