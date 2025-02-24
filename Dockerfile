ARG DEBIAN_VERSION=bullseye
ARG DEBIAN_VERSION_NUMERIC=11

# Builder
FROM --platform=$BUILDPLATFORM node:22-${DEBIAN_VERSION} AS builder

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

FROM nginxinc/nginx-unprivileged:${DEBIAN_VERSION} AS nginx

COPY --from=builder /src/webapp /app

# Override default nginx config. Templates in `/etc/nginx/templates` are passed
# through `envsubst` by the nginx docker image entry point.
COPY /docker/nginx-templates/* /etc/nginx/templates/

USER root
RUN rm -rf /usr/share/nginx/html \
  && ln -s /app /usr/share/nginx/html

# Run a no-op action of nginx to run entrypoint scripts that may tweak config files
USER nginx
RUN ["nginx", "-t"]

# App
FROM gcr.io/distroless/base-nossl-debian${DEBIAN_VERSION_NUMERIC}:debug-nonroot

ARG TARGETARCH
ARG LIBARCH=${TARGETARCH}
ARG LIBARCH=${LIBARCH/amd64/x86_64}
ARG LIBARCH=${LIBARCH/arm64/aarch_64}

COPY --from=nginx \
    /lib/${LIBARCH}-linux-gnu/ld-2.31.so \
    /lib/${LIBARCH}-linux-gnu/libc-2.31.so \
    /lib/${LIBARCH}-linux-gnu/libcrypt.so.1 \
    /lib/${LIBARCH}-linux-gnu/libdl-2.31.so \
    /lib/${LIBARCH}-linux-gnu/libpthread-2.31.so \
    /lib/${LIBARCH}-linux-gnu/libz.so.1 \
    /lib/${LIBARCH}-linux-gnu/

COPY --from=nginx \
    /usr/lib/${LIBARCH}-linux-gnu/libcrypto.so.1.1 \
    /usr/lib/${LIBARCH}-linux-gnu/libpcre2-8.so.0 \
    /usr/lib/${LIBARCH}-linux-gnu/libssl.so.1.1 \
    /usr/lib/${LIBARCH}-linux-gnu/

COPY --from=nginx /usr/sbin/nginx /usr/sbin/nginx
COPY --from=nginx /usr/share/nginx/html /usr/share/nginx/html
COPY --from=nginx /etc/nginx /etc/nginx
COPY --from=nginx /var/log/nginx /var/log/nginx

COPY --from=nginx /etc/passwd /etc/group /etc/

# Run as nginx user by default
USER nginx

# HTTP listen port
ENV ELEMENT_WEB_PORT=80

ENTRYPOINT ["/usr/sbin/nginx", "-g", "daemon off;"]
