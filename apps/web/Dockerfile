# syntax=docker.io/docker/dockerfile:1.26-labs@sha256:63e440b412b6acba117974e793b7e7f702e58ee65e044bdff1b8d388ee0d853b
# Context must be the root of the monorepo

# PNPM source
FROM --platform=$BUILDPLATFORM ghcr.io/pnpm/pnpm:12.0.0@sha256:bce5ae25ef95edd79e696d7fa8489b80561ef660100fd35bd0286d0f90db3dcc AS pnpm

# Builder
FROM --platform=$BUILDPLATFORM node:24-bullseye@sha256:713fab6ef722b3db6e23b694c60bec337055b3598eea59640694c6344d53672f AS builder

COPY --from=pnpm /opt/pnpm /opt/pnpm
RUN ln -s /opt/pnpm/pnpm /usr/local/bin/pnpm

# Support custom branch of the js-sdk. This also helps us build images of element-web develop.
ARG USE_CUSTOM_SDKS=false
ARG JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git"
ARG JS_SDK_BRANCH="master"

WORKDIR /src

# Install dependencies
COPY --parents package.json pnpm-lock.yaml pnpm-workspace.yaml patches scripts **/package.json /src/
RUN pnpm install --frozen-lockfile
RUN --mount=type=bind,source=.git,target=/src/.git /src/scripts/docker-link-repos.sh

# Build
COPY --link --exclude=.git --exclude=apps/web/docker . /src
RUN --mount=type=bind,source=.git,target=/src/.git /src/scripts/docker-package.sh

# Copy the config now so that we don't create another layer in the app image
RUN cp /src/apps/web/config.sample.json /src/apps/web/webapp/config.json

# App
FROM nginxinc/nginx-unprivileged:alpine-slim@sha256:d668aa123a6ec3216ba5ae6b398ae8001d5e81d3142d3659e20354fd0c3c3125 AS element_web

# Need root user to install packages & manipulate the usr directory
USER root

# Install jq and moreutils for sponge, both used by our entrypoints
RUN apk add jq moreutils

COPY --from=builder /src/apps/web/webapp /app

# Override default nginx config. Templates in `/etc/nginx/templates` are passed
# through `envsubst` by the nginx docker image entry point.
COPY /apps/web/docker/nginx-templates/* /etc/nginx/templates/
COPY /apps/web/docker/docker-entrypoint.d/* /docker-entrypoint.d/

RUN rm -rf /usr/share/nginx/html \
  && ln -s /app /usr/share/nginx/html

# Run as nginx user by default
USER nginx

# HTTP listen port
ENV ELEMENT_WEB_PORT=80

HEALTHCHECK --start-period=5s CMD wget -q --spider http://localhost:$ELEMENT_WEB_PORT/config.json

# Modules are consumed as prebuilt release artifacts rather than built from source.
# Each module is pinned to a version and the sha256 of its release archive.
FROM --platform=$BUILDPLATFORM alpine:3.24@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b AS modules

ARG MODULE_BANNER_VERSION=v1.0.0
ADD --checksum=sha256:8aabd9d43d40ffb499050246f7968323a08895b6f53bd48a71d4c7f0daf96634 \
    https://github.com/element-hq/element-web/releases/download/module%2Fbanner%2F${MODULE_BANNER_VERSION}/banner-${MODULE_BANNER_VERSION}.zip \
    /tmp/modules/banner.zip

ARG MODULE_RESTRICTED_GUESTS_VERSION=v1.0.0
ADD --checksum=sha256:d883327469ae78504a4e0aa8ebf2bbf525a9407ab10430ef42cf9338cc0821bb \
    https://github.com/element-hq/element-web/releases/download/module%2Frestricted-guests%2F${MODULE_RESTRICTED_GUESTS_VERSION}/restricted-guests-${MODULE_RESTRICTED_GUESTS_VERSION}.zip \
    /tmp/modules/restricted-guests.zip

ARG MODULE_WIDGET_LIFECYCLE_VERSION=v1.0.0
ADD --checksum=sha256:125e5a7a045e3cebee2c82ca30a477ebc8e31ee3bd139ae46e177612c25cc988 \
    https://github.com/element-hq/element-web/releases/download/module%2Fwidget-lifecycle%2F${MODULE_WIDGET_LIFECYCLE_VERSION}/widget-lifecycle-${MODULE_WIDGET_LIFECYCLE_VERSION}.zip \
    /tmp/modules/widget-lifecycle.zip

ARG MODULE_WIDGET_TOGGLES_VERSION=v1.0.0
ADD --checksum=sha256:27b0d0d9d803c41855aa94f02493ce214321f8d0c65af500d85875a3ef20efb0 \
    https://github.com/element-hq/element-web/releases/download/module%2Fwidget-toggles%2F${MODULE_WIDGET_TOGGLES_VERSION}/widget-toggles-${MODULE_WIDGET_TOGGLES_VERSION}.zip \
    /tmp/modules/widget-toggles.zip

# Unpack the modules
RUN apk add --no-cache unzip && \
    for archive in /tmp/modules/*.zip; do \
        name=$(basename "$archive" .zip); \
        mkdir -p "/modules/$name" && unzip -q "$archive" -d "/modules/$name"; \
    done

# Target with element_web + `/modules` copied in
FROM element_web AS element_web_modules

COPY --from=modules /modules /modules
