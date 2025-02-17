ARG ELEMENT_VERSION=latest
FROM vectorim/element-web:${ELEMENT_VERSION}
ARG ELEMENT_WEB_MODULES=""

# Override default nginx config. Templates in `/etc/nginx/templates` are passed
# through `envsubst` by the nginx docker image entry point.
COPY /docker/nginx-templates/* /etc/nginx/templates/
COPY /docker/docker-entrypoint.d/* /docker-entrypoint.d/

# Create directories before we gain privileges
RUN mkdir -p /tmp/element-web-config /tmp/element-web-modules

# Escalate privileges to install jq and moreutils and run the fetch modules script
USER root
RUN apk add jq moreutils
RUN ELEMENT_WEB_MODULES=${ELEMENT_WEB_MODULES} /docker-entrypoint.d/17-fetch-element-modules.sh

# Drop privileges back to nginx
USER nginx