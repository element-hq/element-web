ARG DEBIAN_VERSION_NUMERIC=12

# Now copy it into our base image.
FROM gcr.io/distroless/base-nossl-debian${DEBIAN_VERSION_NUMERIC}:debug@sha256:12dbb4f46c5f712fe3da1c7a441602ee91eb87a5d46b0e725b4440b852000538 AS build

FROM gcr.io/distroless/base-nossl-debian${DEBIAN_VERSION_NUMERIC}

WORKDIR /src
COPY synapse_guest_module /src/synapse_guest_module
COPY --from=build /busybox/cp /bin/cp

CMD ["cp", "-r", "/src/synapse_guest_module", "/modules"]
