/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it } from "vitest";

import "@vector-im/compound-design-tokens/assets/web/css/compound-design-tokens.css";
import "../../../../res/css/views/settings/_KeyboardShortcut.pcss";

/** The parts of an element's font that Compound's font tokens set. */
function fontOf(element: Element): string[] {
    const style = getComputedStyle(element);
    return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight];
}

describe("A keyboard shortcut", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("draws its keys in Compound's medium body font rather than the browser's monospace font", () => {
        document.body.innerHTML = `
            <span id="token" style="font: var(--cpd-font-body-md-medium)">Ctrl</span>
            <div class="mx_KeyboardShortcut" style="font: 400 12px/1 serif"><kbd>Ctrl</kbd>+<kbd>K</kbd></div>
        `;
        const token = fontOf(document.getElementById("token")!);

        expect(token).toEqual([expect.stringMatching(/^Inter,/), "15px", "500", "22.5px"]);
        for (const key of document.querySelectorAll("kbd")) {
            expect(fontOf(key)).toEqual(token);
        }
    });
});
