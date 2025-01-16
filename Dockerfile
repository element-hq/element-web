# Builder
FROM --platform=$BUILDPLATFORM node:22-bullseye AS builder

# Support custom branch of the js-sdk. This also helps us build images of element-web develop.
ARG USE_CUSTOM_SDKS=false
ARG JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git"
ARG JS_SDK_BRANCH="master"

WORKDIR /src

COPY . /src
RUN /src/scripts/docker-link-repos.sh
RUN yarn --network-timeout=200000 install
RUN /src/scripts/docker-package.sh

# Copy the config now so that we don't create another layer in the app image
RUN cp /src/config.sample.json /src/webapp/config.json

# App
FROM nginx:alpine-slim

COPY --from=builder /src/webapp /app

# Override default nginx config. Templates in `/etc/nginx/templates` are passed
# through `envsubst` by the nginx docker image entry point.
COPY /docker/nginx-templates/* /etc/nginx/templates/

# Tell nginx to put its pidfile elsewhere, so it can run as non-root
RUN sed -i -e 's,/var/run/nginx.pid,/tmp/nginx.pid,' /etc/nginx/nginx.conf

# nginx user must own the cache and etc directory to write cache and tweak the nginx config
RUN chown -R nginx:0 /var/cache/nginx /etc/nginx
RUN chmod -R g+w /var/cache/nginx /etc/nginx

RUN rm -rf /usr/share/nginx/html \
  && ln -s /app /usr/share/nginx/html

# Run as nginx user by default
USER nginx

# HTTP listen port
ENV ELEMENT_WEB_PORT=80
