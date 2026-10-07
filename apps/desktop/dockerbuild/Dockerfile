# syntax=docker.io/docker/dockerfile:1.27-labs@sha256:ae9cc40df4eb5b6adcac0a49bdd8e43b6d29d81087fefae2ceb6fe248aab24c8
# Docker image to facilitate building Element Desktop's native bits against Debian bookworm (glibc 2.36).
# The resulting binaries are checked to require at most glibc 2.35,
# so they run down to Ubuntu jammy (2.35) & Debian bookworm (2.36).

# PNPM source
FROM ghcr.io/pnpm/pnpm:12.0.0@sha256:bce5ae25ef95edd79e696d7fa8489b80561ef660100fd35bd0286d0f90db3dcc AS pnpm

FROM rust:bookworm@sha256:fbc3a359627c6b5d9c8b20aae5c413a87392954f020006d7a9f7d95938964b23

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
