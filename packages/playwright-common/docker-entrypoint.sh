#!/bin/bash

# We use npm here as we used `npm i -g` to install playwright in the Dockerfile
exec npm exec -- /usr/bin/playwright run-server --port "$PORT" --host 0.0.0.0
