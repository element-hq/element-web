/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

function firstDiff(a, b) {
    const compareLen = Math.min(a.length, b.length);
    for (let i = 0; i < compareLen; ++i) {
        if (a[i] !== b[i]) {
            return i;
        }
    }
    return compareLen;
}

function lastDiff(a, b) {
    const compareLen = Math.min(a.length, b.length);
    for (let i = 0; i < compareLen; ++i) {
        if (a[a.length - i] !== b[b.length - i]) {
            return i;
        }
    }
    return compareLen;
}

function diffStringsAtEnd(oldStr, newStr) {
    const len = Math.min(oldStr.length, newStr.length);
    const startInCommon = oldStr.substr(0, len) === newStr.substr(0, len);
    if (startInCommon && oldStr.length > newStr.length) {
        return {removed: oldStr.substr(len), at: len};
    } else if (startInCommon && oldStr.length < newStr.length) {
        return {added: newStr.substr(len), at: len};
    } else {
        const commonStartLen = firstDiff(oldStr, newStr);
        return {
            removed: oldStr.substr(commonStartLen),
            added: newStr.substr(commonStartLen),
            at: commonStartLen,
        };
    }
}

export function diffDeletion(oldStr, newStr) {
    if (oldStr === newStr) {
        return {};
    }
    const firstDiffIdx = firstDiff(oldStr, newStr);
    const lastDiffIdx = oldStr.length - lastDiff(oldStr, newStr) + 1;
    return {at: firstDiffIdx, removed: oldStr.substring(firstDiffIdx, lastDiffIdx)};
}

export function diffInsertion(oldStr, newStr) {
    const diff = diffDeletion(newStr, oldStr);
    if (diff.removed) {
        return {at: diff.at, added: diff.removed};
    } else {
        return diff;
    }
}

export function diffAtCaret(oldValue, newValue, caretPosition) {
    const diffLen = newValue.length - oldValue.length;
    const caretPositionBeforeInput = caretPosition - diffLen;
    const oldValueBeforeCaret = oldValue.substr(0, caretPositionBeforeInput);
    const newValueBeforeCaret = newValue.substr(0, caretPosition);
    return diffStringsAtEnd(oldValueBeforeCaret, newValueBeforeCaret);
}
