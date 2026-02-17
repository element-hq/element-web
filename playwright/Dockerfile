FROM mcr.microsoft.com/playwright:v1.58.2-jammy@sha256:4698a73749c5848d3f5fcd42a2174d172fcad2b2283e087843b115424303a565

WORKDIR /work/element-desktop

RUN apt-get update && apt-get -y install xvfb dbus-x11 && apt-get purge -y --auto-remove && rm -rf /var/lib/apt/lists/*

# Create node_modules & dist dirs so that the volumes have the correct permissions
RUN mkdir node_modules dist && chown 1000:1000 node_modules dist

USER 1000:1000

COPY docker-entrypoint.sh /opt/docker-entrypoint.sh
ENTRYPOINT ["bash", "/opt/docker-entrypoint.sh"]
