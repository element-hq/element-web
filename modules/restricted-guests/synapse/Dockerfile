FROM debian:bookworm-slim

WORKDIR /src
ADD synapse_guest_module /src/synapse_guest_module

CMD ["cp", "-r", "/src/synapse_guest_module", "/modules"]
