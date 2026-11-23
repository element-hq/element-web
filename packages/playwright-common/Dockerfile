# Expose the arguments for use in FROM
ARG PLAYWRIGHT_VERSION
# The Playwright release whose browsers to use. For a fork such as flashwright (e.g. 1.64.1-flashwright.12),
# that is the release it is based on (1.64.1), as there is no Playwright image for the fork's own version.
ARG PLAYWRIGHT_BASE_VERSION=${PLAYWRIGHT_VERSION}
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_BASE_VERSION}-noble
# Expose the argument to this build stage
ARG PLAYWRIGHT_VERSION

WORKDIR /work

# fonts-dejavu is needed for the same RTL rendering as on CI
RUN apt-get update && \
    apt-get -y install docker.io fonts-dejavu && \
    apt-get purge -y --auto-remove && \
    rm -rf /var/lib/apt/lists/*

# Install the matching playwright runtime, the docker image only includes browsers.
# flashwright publishes it as `flashwright`, which still provides the `playwright` command.
RUN case "$PLAYWRIGHT_VERSION" in \
        *-flashwright.*) npm i -g "flashwright@${PLAYWRIGHT_VERSION}" ;; \
        *) npm i -g "playwright@${PLAYWRIGHT_VERSION}" ;; \
    esac

# switch to pwuser
USER 1001:1001

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
ENTRYPOINT ["/usr/bin/docker-init", "/docker-entrypoint.sh"]
