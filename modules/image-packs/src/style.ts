/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import styleText from "./style.css?raw";

const STYLE_ID = "mx-image-packs-module-styles";

/** Keep the direct host integration styled when the module loader is bypassed. */
export function ensureImagePacksStyles(): void {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = styleText;
    document.head.appendChild(style);
}
