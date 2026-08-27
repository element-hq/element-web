# syntax=docker.io/docker/dockerfile:1.26-labs@sha256:63e440b412b6acba117974e793b7e7f702e58ee65e044bdff1b8d388ee0d853b
# Docker image to facilitate building Element Desktop's native bits using a glibc version (2.31)
# with broader compatibility, down to Debian bullseye & Ubuntu focal.

# PNPM source
FROM ghcr.io/pnpm/pnpm:12.0.0@sha256:bce5ae25ef95edd79e696d7fa8489b80561ef660100fd35bd0286d0f90db3dcc AS pnpm

FROM rust:bullseye@sha256:4730e387a220a08a365c77da3096544dde214f9d796c16284d4be45438cad4a9

ENV DEBIAN_FRONTEND=noninteractive

COPY --from=pnpm /opt/pnpm /opt/pnpm
RUN ln -s /opt/pnpm/pnpm /usr/local/bin/pnpm

RUN apt-get -qq update && apt-get -y -qq dist-upgrade && \
  apt-get -y -qq install --no-install-recommends \
  # tclsh is required for building SQLite as part of SQLCipher
  tcl \
  # Used by seshat (when not SQLCIPHER_STATIC) \
  libsqlcipher-dev && \
  apt-get purge -y --auto-remove && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/python3 /usr/bin/python & ln -s /usr/bin/pip3 /usr/bin/pip

ENV DEBUG_COLORS=true
ENV FORCE_COLOR=true
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /project/apps/desktop

ARG TARGETOS
ARG TARGETARCH
COPY .node-version dockerbuild/setup.sh /
RUN /setup.sh
