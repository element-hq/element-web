#!/bin/sh

# Loads modules specified via env var ELEMENT_WEB_MODULES
# in a comma delimited format of `url#hash,url#hash,...`
# the URL should point to a gzipped tarball, e.g. https://registry.npmjs.org/level/-/level-9.0.0.tgz
# the hash should a sha256sum of the tgz/tar.gz archive, it can be omitted though
# Runs both during the build stage and the runtime entrypoint for added flexibility

set -e

entrypoint_log() {
    if [ -z "${NGINX_ENTRYPOINT_QUIET_LOGS:-}" ]; then
        echo "$@"
    fi
}

if [ -z "${ELEMENT_WEB_MODULES}" ]; then
    entrypoint_log "ELEMENT_WEB_MODULES is not set, skipping module loading"
    exit 0
fi

for MODULE in ${ELEMENT_WEB_MODULES//,/ }
do
    MODULE_URL=${MODULE%#*}
    EXPECTED_HASH=${MODULE#*#}

    entrypoint_log "Fetching module from $MODULE_URL"
    wget -O /tmp/element-web-modules/module.tar.gz "$MODULE_URL"
    HASH=$(sha256sum /tmp/element-web-modules/module.tar.gz | awk '{ print $1 }')
    if [ -n "$EXPECTED_HASH" ] && [ "$HASH" != "$EXPECTED_HASH" ]; then
        echo "Hash mismatch for $MODULE_URL: expected $EXPECTED_HASH, got $HASH"
        exit 1
    fi

    mkdir -p "/tmp/element-web-modules/$HASH"
    tar xvf /tmp/element-web-modules/module.tar.gz -C "/tmp/element-web-modules/$HASH" --strip-components=1
    rm -Rf /tmp/element-web-modules/module.tar.gz
done