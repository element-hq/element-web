# syntax=docker.io/docker/dockerfile:1.20-labs@sha256:dbcde2ebc4abc8bb5c3c499b9c9a6876842bf5da243951cd2697f921a7aeb6a9

# Builder
FROM --platform=$BUILDPLATFORM node:24-bullseye@sha256:0cb1bd306f3bdb19174ea9dde765315532cb72074a549a1683fd7aacdde03a52 AS builder

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
FROM nginxinc/nginx-unprivileged:alpine-slim@sha256:9ac6a908ed07ba7d23cbf6048090453a081abf663c53a7c3f3bf96abc16c0799

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
