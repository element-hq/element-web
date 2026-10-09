/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function selectText(target: Element): void {
    const range = document.createRange();
    range.selectNodeContents(target);

    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Copy rich text to user's clipboard
 * It will overwrite user's selection range
 * In certain browsers it may only work if triggered by a user action or may ask user for permissions
 * @param ref pointer to the node to copy
 */
export function copyNode(ref?: Element | null): boolean {
    if (!ref) return false;
    selectText(ref);
    return document.execCommand("copy");
}

/**
 * Returns text which has been selected by the user
 * @returns the selected text
 */
export function getSelectedText(): string {
    return window.getSelection()!.toString();
}

export const graphemeSegmenter = new Intl.Segmenter();

/**
 * Returns the first grapheme in the given string,
 * especially useful for strings containing emoji, will not break compound emoji up.
 * @param str string to parse
 * @returns the first grapheme or an empty string if given an empty string
 */
export function getFirstGrapheme(str: string): string {
    const result = graphemeSegmenter.segment(str)[Symbol.iterator]().next();
    return result.done ? "" : result.value.segment;
}
