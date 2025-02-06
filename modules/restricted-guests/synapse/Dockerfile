FROM debian:bookworm-slim

WORKDIR /src
COPY synapse_guest_module /src/synapse_guest_module

CMD ["cp", "-r", "/src/synapse_guest_module", "/modules"]
