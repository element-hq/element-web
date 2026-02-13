#!/bin/bash

# We use npm here as we used `npm i -g` to install playwright in the Dockerfile
npm exec -- playwright run-server --port "$PORT" --host 0.0.0.0
