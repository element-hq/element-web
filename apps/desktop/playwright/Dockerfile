# syntax=docker.io/docker/dockerfile:1.25-labs@sha256:4426b5e269e36911b94fb79cf67f1fd7155ef11b2bbc8ab23cbfcbc97130efe9

# PNPM source
FROM ghcr.io/pnpm/pnpm:11.10.0@sha256:9a6eb06d5f861d830fe27d85a91415e60527fa45ec45b52ee43c92a8aaf3bf8a AS pnpm

FROM mcr.microsoft.com/playwright:v1.61.1-jammy@sha256:7b86926fff94374389e8e1f4fdc5c76d050d4a06a7886bb537bf412b20e2b71e

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
