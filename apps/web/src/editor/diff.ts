/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export interface IDiff {
    removed?: string;
    added?: string;
    at?: number;
}

function firstDiff(a: string, b: string): number {
    const compareLen = Math.min(a.length, b.length);
    for (let i = 0; i < compareLen; ++i) {
        if (a[i] !== b[i]) {
            return i;
        }
    }
    return compareLen;
}

function diffStringsAtEnd(oldStr: string, newStr: string): IDiff {
    const len = Math.min(oldStr.length, newStr.length);
    const startInCommon = oldStr.slice(0, len) === newStr.slice(0, len);
    if (startInCommon && oldStr.length > newStr.length) {
        return { removed: oldStr.slice(len), at: len };
    } else if (startInCommon && oldStr.length < newStr.length) {
        return { added: newStr.slice(len), at: len };
    } else {
        const commonStartLen = firstDiff(oldStr, newStr);
        return {
            removed: oldStr.slice(commonStartLen),
            added: newStr.slice(commonStartLen),
            at: commonStartLen,
        };
    }
}

// assumes only characters have been deleted at one location in the string, and none added
export function diffDeletion(oldStr: string, newStr: string): IDiff {
    if (oldStr === newStr) {
        return {};
    }
    const firstDiffIdx = firstDiff(oldStr, newStr);
    const amount = oldStr.length - newStr.length;
    return { at: firstDiffIdx, removed: oldStr.slice(firstDiffIdx, firstDiffIdx + amount) };
}

/**
 * Calculates which string was added and removed around the caret position
 * @param {String} oldValue the previous value
 * @param {String} newValue the new value
 * @param {Number} caretPosition the position of the caret after `newValue` was applied.
 * @return {object} an object with `at` as the offset where characters were removed and/or added,
 *                  `added` with the added string (if any), and
 *                  `removed` with the removed string (if any)
 */
export function diffAtCaret(oldValue: string, newValue: string, caretPosition: number): IDiff {
    const diffLen = newValue.length - oldValue.length;
    const caretPositionBeforeInput = caretPosition - diffLen;
    const oldValueBeforeCaret = oldValue.substring(0, caretPositionBeforeInput);
    const newValueBeforeCaret = newValue.substring(0, caretPosition);
    return diffStringsAtEnd(oldValueBeforeCaret, newValueBeforeCaret);
}
