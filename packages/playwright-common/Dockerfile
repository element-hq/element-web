ARG PLAYWRIGHT_VERSION
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
# Expose the argument to this build stage
ARG PLAYWRIGHT_VERSION

WORKDIR /work

# fonts-dejavu is needed for the same RTL rendering as on CI
RUN apt-get update && apt-get -y install docker.io fonts-dejavu
# Install the matching playwright runtime, the docker image only includes browsers
RUN npm i -g playwright@${PLAYWRIGHT_VERSION}

COPY docker-entrypoint.sh /docker-entrypoint.sh

# We use `docker-init` as PID 1, which means that the container shuts down correctly on SIGTERM.
#
# (The problem is that PID 1 doesn't get default signal handlers, and
# playwright server doesn't register a SIGTERM handler, so if that ends up as
# PID 1, then it ignores SIGTERM. Likewise bash doesn't set a SIGTERM handler by default.
#
# The easiest solution is to use docker-init, which is in fact `tini` (https://github.com/krallin/tini).
#
# See https://github.com/krallin/tini/issues/8#issuecomment-146135930 for a good explanation of all this.)
ENTRYPOINT ["/usr/bin/docker-init" "/docker-entrypoint.sh"]
