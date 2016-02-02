#!/bin/bash -l
export NVM_DIR="/home/jenkins/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 4
npm install
(cd node_modules/matrix-react-sdk && npm run build) # npm doesn't do this when dependencies point at github.com >:(
npm run build # Dumps artificats to /vector
rm vector-*.tar.gz || true # rm previous artifacts without failing if it doesn't exist
REACT_SHA=$(git --git-dir node_modules/matrix-react-sdk/.git rev-parse --short=12 HEAD) # use the ACTUAL SHA rather than assume develop
tar -zcvhf vector-$GIT_COMMIT-react-$REACT_SHA.tar.gz vector #g[z]ip, [c]reate archive, [v]erbose, [f]ilename, [h]ard-dereference (do not archive symlinks)
