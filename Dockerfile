# Builder
FROM --platform=$BUILDPLATFORM node:22-bullseye AS builder

# Support custom branch of the js-sdk. This also helps us build images of element-web develop.
ARG USE_CUSTOM_SDKS=false
ARG JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git"
ARG JS_SDK_BRANCH="master"

RUN apt-get update && apt-get install -y git dos2unix

WORKDIR /src

COPY . /src
RUN dos2unix /src/scripts/docker-link-repos.sh && bash /src/scripts/docker-link-repos.sh
RUN yarn --network-timeout=200000 install

RUN dos2unix /src/scripts/docker-package.sh /src/scripts/get-version-from-git.sh /src/scripts/normalize-version.sh && bash /src/scripts/docker-package.sh

# Copy the config now so that we don't create another layer in the app image
RUN cp /src/config.sample.json /src/webapp/config.json

# App
FROM nginx:alpine-slim

COPY --from=builder /src/webapp /app

# Override default nginx config. Templates in `/etc/nginx/templates` are passed
# through `envsubst` by the nginx docker image entry point.
COPY /docker/nginx-templates/* /etc/nginx/templates/

# Override main nginx config, to make it suitable for use with non-root user
RUN sed -i \
      -e '/user *nginx;/d' \
      -e  's,/var/run/nginx.pid,/tmp/nginx.pid,' \
      -e "/^http {/a \    proxy_temp_path /tmp/proxy_temp;\n    client_body_temp_path /tmp/client_temp;\n    fastcgi_temp_path /tmp/fastcgi_temp;\n    uwsgi_temp_path /tmp/uwsgi_temp;\n    scgi_temp_path /tmp/scgi_temp;\n" \
      /etc/nginx/nginx.conf

# nginx user must own the cache and etc directory to write cache and tweak the nginx config
RUN chown -R nginx:0 /var/cache/nginx /etc/nginx
RUN chmod -R g+w /var/cache/nginx /etc/nginx

RUN rm -rf /usr/share/nginx/html \
  && ln -s /app /usr/share/nginx/html

# Run as nginx user by default
USER nginx

# HTTP listen port
ENV ELEMENT_WEB_PORT=80
