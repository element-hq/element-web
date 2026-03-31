# syntax=docker.io/docker/dockerfile:1.22-labs@sha256:4c116b618ed48404d579b5467127b20986f2a6b29e4b9be2fee841f632db6a86
# Context must be the root of the monorepo

# Builder
FROM --platform=$BUILDPLATFORM node:24-bullseye@sha256:4bfbd78e049926e4ca595c1798810691ca7bb5aedd829ffd8a78b2ab30689810 AS builder

# Support custom branch of the js-sdk. This also helps us build images of element-web develop.
ARG USE_CUSTOM_SDKS=false
ARG JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git"
ARG JS_SDK_BRANCH="master"

WORKDIR /src

# Install dependencies
COPY --parents package.json pnpm-lock.yaml pnpm-workspace.yaml patches scripts **/package.json /src/
RUN corepack enable
RUN --mount=type=bind,source=.git,target=/src/.git /src/scripts/docker-link-repos.sh
RUN pnpm install

# Build
COPY --link --exclude=.git --exclude=apps/web/docker . /src
RUN --mount=type=bind,source=.git,target=/src/.git /src/scripts/docker-package.sh

# Copy the config now so that we don't create another layer in the app image
RUN cp /src/apps/web/config.sample.json /src/apps/web/webapp/config.json

# App
FROM nginxinc/nginx-unprivileged:alpine-slim@sha256:b5831ee7f7aa827cbae87df4a30a642f62c747d8525f5674365389f3adab278d

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
