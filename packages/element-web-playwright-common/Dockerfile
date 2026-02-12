ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

WORKDIR /work

# fonts-dejavu is needed for the same RTL rendering as on CI
RUN apt-get update && apt-get -y install docker.io fonts-dejavu

# Set up corepack
RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# Add environment variable so consumers can skip developer-centric scripts
ENV PLAYWRIGHT_COMMON_DOCKER=1

COPY docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
