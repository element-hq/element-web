#! /bin/sh
#
# build.sh
# Copyright (C) 2016 Óscar García Amor <ogarcia@connectical.com>
#
# Distributed under terms of the GNU GPLv3 license.
#

default_hs_url=${default_hs_url:-https://matrix.org}
default_is_url=${default_is_url:-https://vector.im}
brand=${brand:-Vector}
integrations_ui_url=${integrations_ui_url:-http://localhost:8081}
integrations_rest_url=${integrations_rest_url:-http://localhost:5050}

# Make config file using environment vars
cat > config.json << EOF
{
  "default_hs_url": "${default_hs_url}",
  "default_is_url": "${default_is_url}",
  "brand": "${brand}",
  "integrations_ui_url": "${integrations_ui_url}",
  "integrations_rest_url": "${integrations_rest_url}"
}
EOF

# Build vector
npm run build

# Make deploy dir
# This not is necessary if the user mount correctly the container volume,
# but, Hey! THEY ARE USERS!!! ;D
mkdir -p /deploy

# Copy vector to deploy dir
cp -Lr vector/* /deploy
