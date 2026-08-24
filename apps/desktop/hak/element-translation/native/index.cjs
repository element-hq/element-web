/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Loader for the native macOS translation addon. On platforms where the addon
// wasn't built (non-macOS, or build skipped) this degrades gracefully so callers
// can simply treat translation as unavailable.

let native = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = require("./build/Release/translation.node");
} catch {
    native = null;
}

module.exports = {
    isAvailable() {
        try {
            return !!native && native.isAvailable();
        } catch {
            return false;
        }
    },
    showTranslation(viewHandle, text, x, y, width, height) {
        if (!native) return;
        try {
            native.showTranslation(viewHandle, text, x, y, width, height);
        } catch {
            // ignore — best effort
        }
    },
};
