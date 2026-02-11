/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Part, Type } from "./parts";
import type EditorModel from "./model";

export function needsCaretNodeBefore(part: Part, prevPart?: Part): boolean {
    const isFirst = !prevPart || prevPart.type === Type.Newline;
    return !part.acceptsCaret && (isFirst || !prevPart.acceptsCaret);
}

export function needsCaretNodeAfter(part: Part, isLastOfLine: boolean): boolean {
    return !part.acceptsCaret && isLastOfLine;
}

function insertAfter(node: ChildNode, nodeToInsert: ChildNode): void {
    const next = node.nextSibling;
    if (next) {
        node.parentElement!.insertBefore(nodeToInsert, next);
    } else {
        node.parentElement!.appendChild(nodeToInsert);
    }
}

// Use a BOM marker for caret nodes.
// On a first test, they seem to be filtered out when copying text out of the editor,
// but this could be platform dependent.
// As a precautionary measure, I chose the character that slate also uses.
export const CARET_NODE_CHAR = "\ufeff";
// a caret node is a node that allows the caret to be placed
// where otherwise it wouldn't be possible
// (e.g. next to a pill span without adjacent text node)
function createCaretNode(): HTMLElement {
    const span = document.createElement("span");
    span.className = "caretNode";
    span.appendChild(document.createTextNode(CARET_NODE_CHAR));
    return span;
}

function updateCaretNode(node: ChildNode): void {
    // ensure the caret node contains only a zero-width space
    if (node.textContent !== CARET_NODE_CHAR) {
        node.textContent = CARET_NODE_CHAR;
    }
}

export function isCaretNode(node?: Node | null): node is HTMLElement {
    return !!node && node instanceof HTMLElement && node.tagName === "SPAN" && node.className === "caretNode";
}

function removeNextSiblings(node: ChildNode | null): void {
    if (!node) {
        return;
    }
    node = node.nextSibling;
    while (node) {
        const removeNode = node;
        node = node.nextSibling;
        removeNode.remove();
    }
}

function removeChildren(parent: HTMLElement): void {
    const firstChild = parent.firstChild;
    if (firstChild) {
        removeNextSiblings(firstChild);
        firstChild.remove();
    }
}

function reconcileLine(lineContainer: ChildNode, parts: Part[]): void {
    let currentNode: ChildNode | null = null;
    let prevPart: Part | undefined;
    const lastPart = parts[parts.length - 1];

    for (const part of parts) {
        const isFirst = !prevPart;
        currentNode = isFirst ? lineContainer.firstChild : currentNode!.nextSibling;

        if (needsCaretNodeBefore(part, prevPart)) {
            if (isCaretNode(currentNode as Element)) {
                updateCaretNode(currentNode!);
                currentNode = currentNode!.nextSibling;
            } else {
                lineContainer.insertBefore(createCaretNode(), currentNode);
            }
        }
        // remove nodes until matching current part
        while (currentNode && !part.canUpdateDOMNode(currentNode)) {
            const nextNode = currentNode.nextSibling;
            lineContainer.removeChild(currentNode);
            currentNode = nextNode;
        }
        // update or insert node for current part
        if (currentNode && part) {
            part.updateDOMNode(currentNode);
        } else if (part) {
            currentNode = part.toDOMNode() as ChildNode;
            // hooks up nextSibling for next iteration
            lineContainer.appendChild(currentNode);
        }

        if (needsCaretNodeAfter(part, part === lastPart)) {
            if (isCaretNode(currentNode?.nextSibling as Element)) {
                currentNode = currentNode!.nextSibling;
                updateCaretNode(currentNode as HTMLElement);
            } else {
                const caretNode = createCaretNode();
                insertAfter(currentNode as HTMLElement, caretNode);
                currentNode = caretNode;
            }
        }

        prevPart = part;
    }

    removeNextSiblings(currentNode);
}

function reconcileEmptyLine(lineContainer: HTMLElement): void {
    // empty div needs to have a BR in it to give it height
    let foundBR = false;
    let partNode = lineContainer.firstChild;
    while (partNode) {
        const nextNode = partNode.nextSibling;
        if (!foundBR && (partNode as HTMLElement).tagName === "BR") {
            foundBR = true;
        } else {
            partNode.remove();
        }
        partNode = nextNode;
    }
    if (!foundBR) {
        lineContainer.appendChild(document.createElement("br"));
    }
}

export function renderModel(editor: HTMLDivElement, model: EditorModel): void {
    const lines = model.parts.reduce<Part[][]>(
        (linesArr, part) => {
            if (part.type === Type.Newline) {
                linesArr.push([]);
            } else {
                const lastLine = linesArr[linesArr.length - 1];
                lastLine.push(part);
            }
            return linesArr;
        },
        [[]],
    );
    lines.forEach((parts, i) => {
        // find first (and remove anything else) div without className
        // (as browsers insert these in contenteditable) line container
        let lineContainer = editor.childNodes[i];
        while (lineContainer && ((<Element>lineContainer).tagName !== "DIV" || !!(<Element>lineContainer).className)) {
            editor.removeChild(lineContainer);
            lineContainer = editor.childNodes[i];
        }
        if (!lineContainer) {
            lineContainer = document.createElement("div");
            editor.appendChild(lineContainer);
        }

        if (parts.length) {
            reconcileLine(lineContainer, parts);
        } else {
            reconcileEmptyLine(lineContainer as HTMLElement);
        }
    });
    if (lines.length) {
        removeNextSiblings(editor.children[lines.length - 1]);
    } else {
        removeChildren(editor);
    }
}
