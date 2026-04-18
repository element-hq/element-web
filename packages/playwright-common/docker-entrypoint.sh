#!/bin/bash
exec /usr/bin/playwright run-server --port "$PORT" --host 0.0.0.0
