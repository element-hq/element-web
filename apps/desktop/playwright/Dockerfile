# syntax=docker.io/docker/dockerfile:1.29-labs@sha256:36366b12c1dffb228bb25e9feffb73707b93388f084f4927d2b7686dba29e76a

# PNPM source
FROM ghcr.io/pnpm/pnpm:12.21.0@sha256:168feba88e6a1684c99a62cbf4fe361d4e683e2a6c920d3b0acde7e15a28b62d AS pnpm

FROM mcr.microsoft.com/playwright:v1.65.1-jammy@sha256:b0ee5ce5e14ac42c394c0564a0a30adbda052153c611561bb2d31263593d6dd8

WORKDIR /work

COPY --from=pnpm /opt/pnpm /opt/pnpm
RUN ln -s /opt/pnpm/pnpm /usr/local/bin/pnpm

RUN apt-get update && \
    apt-get -y install xvfb dbus-x11 && \
    apt-get purge -y --auto-remove && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@latest-11

ENV GITHUB_ACTIONS=1
ENV DEBUG=pw:browser

# switch to node user
USER 1000:1000

COPY apps/desktop/playwright/docker-entrypoint.sh /opt/docker-entrypoint.sh
ENTRYPOINT ["bash", "/opt/docker-entrypoint.sh"]
