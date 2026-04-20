FROM mcr.microsoft.com/playwright:v1.59.1-jammy@sha256:8a0360d39d1973be506dd59002904a774f6d697d4946c94063b3fd006461c8ff

WORKDIR /work

RUN apt-get update && \
    apt-get -y install xvfb dbus-x11 && \
    apt-get purge -y --auto-remove && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV GITHUB_ACTIONS=1
ENV DEBUG=pw:browser

USER 1000:1000

COPY docker-entrypoint.sh /opt/docker-entrypoint.sh
ENTRYPOINT ["bash", "/opt/docker-entrypoint.sh"]
