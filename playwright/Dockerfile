FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /work/matrix-react-sdk
VOLUME ["/work/element-web/node_modules"]

RUN apt-get update && apt-get -y install docker.io

COPY docker-entrypoint.sh /opt/docker-entrypoint.sh
ENTRYPOINT ["bash", "/opt/docker-entrypoint.sh"]
