/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it } from "vitest";

import "../../../../res/css/views/settings/_KeyboardShortcut.pcss";

describe("A keyboard shortcut", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("draws its keys in the font around it rather than the browser's monospace font", () => {
        document.body.innerHTML = `
            <div class="mx_KeyboardShortcut" style="font-family: Inter, sans-serif"><kbd>Ctrl</kbd>+<kbd>K</kbd></div>
        `;

        for (const key of document.querySelectorAll("kbd")) {
            expect(getComputedStyle(key).fontFamily).toBe("Inter, sans-serif");
        }
    });
});
