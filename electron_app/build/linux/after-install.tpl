#!/bin/bash

# Link to the binary
ln -sf '/opt/${productFilename}/${executable}' '/usr/bin/${executable}'

# SUID chrome-sandbox for Electron 5+
# Remove this entire file (after-install.tpl) and remove the reference in
# package.json once this change has been upstreamed so we go back to the copy
# from upstream.
# https://github.com/electron-userland/electron-builder/pull/4163
chmod 4755 '/opt/${productFilename}/chrome-sandbox' || true

update-mime-database /usr/share/mime || true
update-desktop-database /usr/share/applications || true
