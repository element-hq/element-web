#!/bin/sh

# Loads modules from `/modules` into config.json's `modules` field

set -e

entrypoint_log() {
    if [ -z "${NGINX_ENTRYPOINT_QUIET_LOGS:-}" ]; then
        echo "$@"
    fi
}

# Copy these config files as a base
mkdir -p /tmp/element-web-config
cp /app/config*.json /tmp/element-web-config/

# If there are modules to be loaded
if [ -d "/modules" ]; then
    cd /modules

    for MODULE in *
    do
        # If the module has a package.json, use its main field as the entrypoint
        ENTRYPOINT="index.js"
        if [ -f "/modules/$MODULE/package.json" ]; then
            ENTRYPOINT=$(jq -r '.main' "/modules/$MODULE/package.json")
        fi

        entrypoint_log "Loading module $MODULE with entrypoint $ENTRYPOINT"

        # Append the module to the config
        jq ".modules += [\"/modules/$MODULE/$ENTRYPOINT\"]" /tmp/element-web-config/config.json | sponge /tmp/element-web-config/config.json
    done
fi
