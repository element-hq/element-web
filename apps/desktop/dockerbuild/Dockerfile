# syntax=docker.io/docker/dockerfile:1.29-labs@sha256:36366b12c1dffb228bb25e9feffb73707b93388f084f4927d2b7686dba29e76a
# Docker image to facilitate building Element Desktop's native bits against Debian bookworm (glibc 2.36).
# The resulting binaries are checked against MAX_GLIBC in scripts/native-libraries.ts,
# so they run down to Ubuntu jammy (2.35) & Debian bookworm (2.36).

# PNPM source
FROM ghcr.io/pnpm/pnpm:12.22.0@sha256:81346f048d668195928d441b80efc0df300474ed8bf81789e4554ec0079079d0 AS pnpm

FROM rust:bookworm@sha256:ade39a710ef85f3506cffcfec3e8a24ba090badef1dff2fb798f71d878833fea

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
