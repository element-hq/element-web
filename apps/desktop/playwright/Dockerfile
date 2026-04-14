FROM mcr.microsoft.com/playwright:v1.59.1-jammy@sha256:8a0360d39d1973be506dd59002904a774f6d697d4946c94063b3fd006461c8ff

WORKDIR /work/element-desktop

RUN apt-get update && apt-get -y install xvfb dbus-x11 && apt-get purge -y --auto-remove && rm -rf /var/lib/apt/lists/*

# Create node_modules & dist dirs so that the volumes have the correct permissions
RUN mkdir node_modules dist && chown 1000:1000 node_modules dist

USER 1000:1000

COPY docker-entrypoint.sh /opt/docker-entrypoint.sh
ENTRYPOINT ["bash", "/opt/docker-entrypoint.sh"]
