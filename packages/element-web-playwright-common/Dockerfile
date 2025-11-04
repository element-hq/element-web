ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

WORKDIR /work

# fonts-dejavu is needed for the same RTL rendering as on CI
RUN apt-get update && apt-get -y install docker.io fonts-dejavu

# Disable the ryuk resource reaper, because it doesn't work in environments
# that disallow starting privileged containers (such as rootless containers)
ENV TESTCONTAINERS_RYUK_DISABLED=true

ENTRYPOINT ["npx", "playwright", "test", "--update-snapshots", "--reporter", "line"]
