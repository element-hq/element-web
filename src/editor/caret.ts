/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { needsCaretNodeBefore, needsCaretNodeAfter } from "./render";
import Range from "./range";
import type EditorModel from "./model";
import { type IPosition } from "./position";
import type DocumentPosition from "./position";
import { type Part, Type } from "./parts";

export type Caret = Range | DocumentPosition;

export function setSelection(editor: HTMLDivElement, model: EditorModel, selection: Range | IPosition): void {
    if (selection instanceof Range) {
        setDocumentRangeSelection(editor, model, selection);
    } else {
        setCaretPosition(editor, model, selection);
    }
}

function setDocumentRangeSelection(editor: HTMLDivElement, model: EditorModel, range: Range): void {
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    const selectionRange = document.createRange();
    const start = getNodeAndOffsetForPosition(editor, model, range.start);
    selectionRange.setStart(start.node, start.offset);
    const end = getNodeAndOffsetForPosition(editor, model, range.end);
    selectionRange.setEnd(end.node, end.offset);
    sel.addRange(selectionRange);
}

export function setCaretPosition(editor: HTMLDivElement, model: EditorModel, caretPosition: IPosition): void {
    if (model.isEmpty) return; // selection can't possibly be wrong, so avoid a reflow

    const range = document.createRange();
    const { node, offset } = getNodeAndOffsetForPosition(editor, model, caretPosition);
    range.setStart(node, offset);
    range.collapse(true);

    const sel = document.getSelection()!;
    if (sel.rangeCount === 1) {
        const existingRange = sel.getRangeAt(0);
        if (
            existingRange.startContainer === range.startContainer &&
            existingRange.startOffset === range.startOffset &&
            existingRange.collapsed === range.collapsed
        ) {
            // If the selection matches, it's important to leave it alone.
            // Recreating the selection state in at least Chrome can cause
            // strange side effects, like touch bar flickering on every key.
            // See https://github.com/vector-im/element-web/issues/9299
            return;
        }
    }
    sel.removeAllRanges();
    sel.addRange(range);
}

function getNodeAndOffsetForPosition(
    editor: HTMLDivElement,
    model: EditorModel,
    position: IPosition,
): {
    node: Node;
    offset: number;
} {
    const { offset, lineIndex, nodeIndex } = getLineAndNodePosition(model, position);
    const lineNode = editor.childNodes[lineIndex];

    let focusNode;
    // empty line with just a <br>
    if (nodeIndex === -1) {
        focusNode = lineNode;
    } else {
        focusNode = lineNode.childNodes[nodeIndex];
        // make sure we have a text node
        if (focusNode.nodeType === Node.ELEMENT_NODE && focusNode.firstChild) {
            focusNode = focusNode.firstChild;
        }
    }
    return { node: focusNode, offset };
}

export function getLineAndNodePosition(
    model: EditorModel,
    caretPosition: IPosition,
): {
    offset: number;
    lineIndex: number;
    nodeIndex: number;
} {
    const { parts } = model;
    const partIndex = caretPosition.index;
    let { offset } = caretPosition;
    const lineResult = findNodeInLineForPart(parts, partIndex, offset);
    const { lineIndex } = lineResult;
    let { nodeIndex } = lineResult;
    // we're at an empty line between a newline part
    // and another newline part or end/start of parts.
    // set offset to 0 so it gets set to the <br> inside the line container
    if (nodeIndex === -1) {
        offset = 0;
    } else {
        // move caret out of uneditable part (into caret node, or empty line br) if needed
        ({ nodeIndex, offset } = moveOutOfUnselectablePart(parts, partIndex, nodeIndex, offset));
    }
    return { lineIndex, nodeIndex, offset };
}

function findNodeInLineForPart(
    parts: Part[],
    partIndex: number,
    offset: number,
): { lineIndex: number; nodeIndex: number } {
    let lineIndex = 0;
    let nodeIndex = -1;

    let prevPart: Part | undefined;
    // go through to parts up till (and including) the index
    // to find newline parts
    for (let i = 0; i <= partIndex; ++i) {
        const part = parts[i];
        if (part.type === Type.Newline) {
            // don't jump over the linebreak if the offset is before it
            if (i == partIndex && offset === 0) {
                continue;
            }
            lineIndex += 1;
            nodeIndex = -1;
            prevPart = undefined;
        } else {
            nodeIndex += 1;
            if (needsCaretNodeBefore(part, prevPart)) {
                nodeIndex += 1;
            }
            // only jump over caret node if we're not at our destination node already,
            // as we'll assume in moveOutOfUnselectablePart that nodeIndex
            // refers to the node corresponding to the part,
            // and not an adjacent caret node
            if (i < partIndex) {
                const nextPart = parts[i + 1];
                const isLastOfLine = !nextPart || nextPart.type === Type.Newline;
                if (needsCaretNodeAfter(part, isLastOfLine)) {
                    nodeIndex += 1;
                }
            }
            prevPart = part;
        }
    }

    return { lineIndex, nodeIndex };
}

function moveOutOfUnselectablePart(
    parts: Part[],
    partIndex: number,
    nodeIndex: number,
    offset: number,
): { offset: number; nodeIndex: number } {
    // move caret before or after unselectable part
    const part = parts[partIndex];
    if (part && !part.acceptsCaret) {
        if (offset === 0) {
            nodeIndex -= 1;
            const prevPart = parts[partIndex - 1];
            // if the previous node is a caret node, it's empty
            // so the offset can stay at 0
            // only when it's not, we need to set the offset
            // at the end of the node
            if (!needsCaretNodeBefore(part, prevPart)) {
                offset = prevPart.text.length;
            }
        } else {
            nodeIndex += 1;
            offset = 0;
        }
    }
    return { nodeIndex, offset };
}
