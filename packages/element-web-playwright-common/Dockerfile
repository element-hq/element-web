ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

WORKDIR /work

# fonts-dejavu is needed for the same RTL rendering as on CI
RUN apt-get update && apt-get -y install docker.io fonts-dejavu

COPY docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
