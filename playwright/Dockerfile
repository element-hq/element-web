FROM mcr.microsoft.com/playwright:v1.46.1-jammy

WORKDIR /work/matrix-react-sdk
VOLUME ["/work/element-web/node_modules"]

# fonts-dejavu is needed for the same RTL rendering as on CI
RUN apt-get update && apt-get -y install docker.io fonts-dejavu

COPY docker-entrypoint.sh /opt/docker-entrypoint.sh
ENTRYPOINT ["bash", "/opt/docker-entrypoint.sh"]
