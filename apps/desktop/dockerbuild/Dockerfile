# syntax=docker.io/docker/dockerfile:1.28-labs@sha256:ad43eec41369d9ef94412c0d1eb3203d12218d01da225afc92a3aeba3a0e7796
# Docker image to facilitate building Element Desktop's native bits against Debian bookworm (glibc 2.36).
# The resulting binaries are checked against MAX_GLIBC in scripts/native-libraries.ts,
# so they run down to Ubuntu jammy (2.35) & Debian bookworm (2.36).

# PNPM source
FROM ghcr.io/pnpm/pnpm:12.18.0@sha256:41c39d1c734b0a810669c07587888aa7dbe9ef9b4c8e98b346b3654f7b269b6d AS pnpm

FROM rust:bookworm@sha256:9181b56c2a21ab1d5e73cffe04fc762426d30aa7fac3c91141dd033f49a7fc8b

COPY --from=pnpm /opt/pnpm /opt/pnpm
RUN ln -s /opt/pnpm/pnpm /usr/local/bin/pnpm

RUN ln -s /usr/bin/python3 /usr/bin/python & ln -s /usr/bin/pip3 /usr/bin/pip

ENV DEBUG_COLORS=true
ENV FORCE_COLOR=true
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /project/apps/desktop

ARG TARGETOS
ARG TARGETARCH
COPY .node-version dockerbuild/setup.sh /
RUN /setup.sh
