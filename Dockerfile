# syntax=docker.io/docker/dockerfile:1.14-labs

# Builder
FROM --platform=$BUILDPLATFORM node:22-bullseye AS builder

# Support custom branch of the js-sdk. This also helps us build images of element-web develop.
ARG USE_CUSTOM_SDKS=false
ARG JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git"
ARG JS_SDK_BRANCH="master"

WORKDIR /src

COPY --exclude=docker . /src
RUN /src/scripts/docker-link-repos.sh
RUN yarn --network-timeout=200000 install
RUN /src/scripts/docker-package.sh

# Copy the config now so that we don't create another layer in the app image
RUN cp /src/config.sample.json /src/webapp/config.json

# App
FROM nginxinc/nginx-unprivileged:alpine-slim

# Need root user to install packages & manipulate the usr directory
USER root

# Install jq and moreutils for sponge, both used by our entrypoints
RUN apk add jq moreutils

COPY --from=builder /src/webapp /app

# Override default nginx config. Templates in `/etc/nginx/templates` are passed
# through `envsubst` by the nginx docker image entry point.
COPY /docker/nginx-templates/* /etc/nginx/templates/
COPY /docker/docker-entrypoint.d/* /docker-entrypoint.d/

RUN rm -rf /usr/share/nginx/html \
  && ln -s /app /usr/share/nginx/html

# Run as nginx user by default
USER nginx

# HTTP listen port
ENV ELEMENT_WEB_PORT=80

HEALTHCHECK --start-period=5s CMD wget -q --spider http://localhost:$ELEMENT_WEB_PORT/config.json
