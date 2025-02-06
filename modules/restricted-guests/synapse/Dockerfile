ARG DEBIAN_VERSION_NUMERIC=12
FROM gcr.io/distroless/base-nossl-debian${DEBIAN_VERSION_NUMERIC}

WORKDIR /src
COPY synapse_guest_module /src/synapse_guest_module

CMD ["cp", "-r", "/src/synapse_guest_module", "/modules"]
