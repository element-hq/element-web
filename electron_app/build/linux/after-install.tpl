#!/bin/bash

# Link to the binary
ln -sf '/opt/${productFilename}/${executable}' '/usr/bin/${executable}'

# SUID chrome-sandbox for Electron 5+
# Remove this custom after-install.tpl once this change has been upstreamed
# https://github.com/electron-userland/electron-builder/pull/4163
chmod 4755 '/opt/${productFilename}/chrome-sandbox' || true

update-mime-database /usr/share/mime || true
update-desktop-database /usr/share/applications || true
