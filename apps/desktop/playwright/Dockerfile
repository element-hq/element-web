# syntax=docker.io/docker/dockerfile:1.28-labs@sha256:ad43eec41369d9ef94412c0d1eb3203d12218d01da225afc92a3aeba3a0e7796

# PNPM source
FROM ghcr.io/pnpm/pnpm:12.12.1@sha256:150c9372f3a6d02039f11dc7d1f6070896567038968c97bbb224e3b03ee3cbcc AS pnpm

FROM mcr.microsoft.com/playwright:v1.64.0-jammy@sha256:c064e7f355d2dda32f669801a1b09e86a1e9252395c844d2cfbbe5c44acb9b79

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
