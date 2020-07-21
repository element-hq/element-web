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

import {Part} from "./parts";
import EditorModel from "./model";

export function needsCaretNodeBefore(part: Part, prevPart: Part) {
    const isFirst = !prevPart || prevPart.type === "newline";
    return !part.canEdit && (isFirst || !prevPart.canEdit);
}

export function needsCaretNodeAfter(part: Part, isLastOfLine: boolean) {
    return !part.canEdit && isLastOfLine;
}

function insertAfter(node: HTMLElement, nodeToInsert: HTMLElement) {
    const next = node.nextSibling;
    if (next) {
        node.parentElement.insertBefore(nodeToInsert, next);
    } else {
        node.parentElement.appendChild(nodeToInsert);
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
function createCaretNode() {
    const span = document.createElement("span");
    span.className = "caretNode";
    span.appendChild(document.createTextNode(CARET_NODE_CHAR));
    return span;
}

function updateCaretNode(node: HTMLElement) {
    // ensure the caret node contains only a zero-width space
    if (node.textContent !== CARET_NODE_CHAR) {
        node.textContent = CARET_NODE_CHAR;
    }
}

export function isCaretNode(node: HTMLElement) {
    return node && node.tagName === "SPAN" && node.className === "caretNode";
}

function removeNextSiblings(node: ChildNode) {
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

function removeChildren(parent: HTMLElement) {
    const firstChild = parent.firstChild;
    if (firstChild) {
        removeNextSiblings(firstChild);
        firstChild.remove();
    }
}

function reconcileLine(lineContainer: ChildNode, parts: Part[]) {
    let currentNode;
    let prevPart;
    const lastPart = parts[parts.length - 1];

    for (const part of parts) {
        const isFirst = !prevPart;
        currentNode = isFirst ? lineContainer.firstChild : currentNode.nextSibling;

        if (needsCaretNodeBefore(part, prevPart)) {
            if (isCaretNode(currentNode)) {
                updateCaretNode(currentNode);
                currentNode = currentNode.nextSibling;
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
            currentNode = part.toDOMNode();
            // hooks up nextSibling for next iteration
            lineContainer.appendChild(currentNode);
        }

        if (needsCaretNodeAfter(part, part === lastPart)) {
            if (isCaretNode(currentNode.nextSibling)) {
                currentNode = currentNode.nextSibling;
                updateCaretNode(currentNode);
            } else {
                const caretNode = createCaretNode();
                insertAfter(currentNode, caretNode);
                currentNode = caretNode;
            }
        }

        prevPart = part;
    }

    removeNextSiblings(currentNode);
}

function reconcileEmptyLine(lineContainer) {
    // empty div needs to have a BR in it to give it height
    let foundBR = false;
    let partNode = lineContainer.firstChild;
    while (partNode) {
        const nextNode = partNode.nextSibling;
        if (!foundBR && partNode.tagName === "BR") {
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

export function renderModel(editor: HTMLDivElement, model: EditorModel) {
    const lines = model.parts.reduce((linesArr, part) => {
        if (part.type === "newline") {
            linesArr.push([]);
        } else {
            const lastLine = linesArr[linesArr.length - 1];
            lastLine.push(part);
        }
        return linesArr;
    }, [[]]);
    lines.forEach((parts, i) => {
        // find first (and remove anything else) div without className
        // (as browsers insert these in contenteditable) line container
        let lineContainer = editor.children[i];
        while (lineContainer && (lineContainer.tagName !== "DIV" || !!lineContainer.className)) {
            editor.removeChild(lineContainer);
            lineContainer = editor.children[i];
        }
        if (!lineContainer) {
            lineContainer = document.createElement("div");
            editor.appendChild(lineContainer);
        }

        if (parts.length) {
            reconcileLine(lineContainer, parts);
        } else {
            reconcileEmptyLine(lineContainer);
        }
    });
    if (lines.length) {
        removeNextSiblings(editor.children[lines.length - 1]);
    } else {
        removeChildren(editor);
    }
}
