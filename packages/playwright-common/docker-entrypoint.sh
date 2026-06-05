#!/bin/bash

# --unsafe allows clients to pass CLI flags to chromium for things like disabling
# subpixel rendering which we need for consistent screenshots. 
# Better might be to specify them statically here but unfortunately that's not an
# option.
exec /usr/bin/playwright run-server --port "$PORT" --host 0.0.0.0 --unsafe
