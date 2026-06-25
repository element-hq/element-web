FROM mcr.microsoft.com/playwright:v1.61.0-jammy@sha256:264136758e43332108f6420f82c47f639f619ca65301065ceade677763f477ec

WORKDIR /work

RUN apt-get update && \
    apt-get -y install xvfb dbus-x11 && \
    apt-get purge -y --auto-remove && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV GITHUB_ACTIONS=1
ENV DEBUG=pw:browser

# switch to node user
USER 1000:1000

COPY apps/desktop/playwright/docker-entrypoint.sh /opt/docker-entrypoint.sh
ENTRYPOINT ["bash", "/opt/docker-entrypoint.sh"]
