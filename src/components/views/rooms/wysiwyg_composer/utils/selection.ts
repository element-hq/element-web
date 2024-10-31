/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { SubSelection } from "../types";

export function setSelection(selection: SubSelection): Promise<void> {
    if (selection.anchorNode && selection.focusNode) {
        const range = new Range();

        if (selection.isForward) {
            range.setStart(selection.anchorNode, selection.anchorOffset);
            range.setEnd(selection.focusNode, selection.focusOffset);
        } else {
            range.setStart(selection.focusNode, selection.focusOffset);
            range.setEnd(selection.anchorNode, selection.anchorOffset);
        }
        document.getSelection()?.removeAllRanges();
        document.getSelection()?.addRange(range);
    }

    // Waiting for the next loop to ensure that the selection is effective
    return new Promise((resolve) => setTimeout(resolve, 0));
}

export function isSelectionEmpty(): boolean {
    const selection = document.getSelection();
    return Boolean(selection?.isCollapsed);
}

export function isCaretAtStart(editor: HTMLElement): boolean {
    const selection = document.getSelection();

    // No selection or the caret is not at the beginning of the selected element
    if (!selection) {
        return false;
    }

    // When we are pressing keyboard up in an empty main composer, the selection is on the editor with an anchorOffset at O or 1 (yes, this is strange)
    const isOnFirstElement = selection.anchorNode === editor && selection.anchorOffset <= 1;
    if (isOnFirstElement) {
        return true;
    }

    // In case of nested html elements (list, code blocks), we are going through all the first child
    let child = editor.firstChild;
    do {
        if (child === selection.anchorNode) {
            return selection.anchorOffset === 0;
        }
    } while ((child = child?.firstChild || null));

    return false;
}

export function isCaretAtEnd(editor: HTMLElement): boolean {
    const selection = document.getSelection();

    if (!selection) {
        return false;
    }

    // When we are cycling across all the timeline message with the keyboard
    // The caret is on the last text element but focusNode and anchorNode refers to the editor div
    // In this case, the focusOffset & anchorOffset match the index + 1 of the selected text
    const isOnLastElement = selection.focusNode === editor && selection.focusOffset === editor.childNodes?.length;
    if (isOnLastElement) {
        return true;
    }

    // In case of nested html elements (list, code blocks), we are going through all the last child
    // The last child of the editor is always a <br> tag, we skip it
    let child: ChildNode | null = editor.childNodes.item(editor.childNodes.length - 2);
    do {
        if (child === selection.focusNode) {
            // Checking that the cursor is at end of the selected text
            return selection.focusOffset === child.textContent?.length;
        }
    } while ((child = child.lastChild));

    return false;
}
