/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * Copy plaintext to user's clipboard
 * It will overwrite user's selection range
 * In certain browsers it may only work if triggered by a user action or may ask user for permissions
 * Tries to use new async clipboard API if available
 * @param text the plaintext to put in the user's clipboard
 * @returns true if the text was copied
 */
export async function copyPlainTextToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;

            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            const selection = document.getSelection()!;
            const range = document.createRange();
            range.selectNode(textArea);
            selection.removeAllRanges();
            selection.addRange(range);

            const successful = document.execCommand("copy");
            selection.removeAllRanges();
            document.body.removeChild(textArea);
            return successful;
        }
    } catch (e) {
        console.error("copyPlainTextToClipboard failed", e);
    }
    return false;
}
