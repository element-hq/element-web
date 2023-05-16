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

import { CARET_NODE_CHAR, isCaretNode } from "./render";
import DocumentOffset from "./offset";
import EditorModel from "./model";
import Range from "./range";

type Predicate = (node: Node) => boolean;
type Callback = (node: Node) => void;

export function walkDOMDepthFirst(rootNode: Node, enterNodeCallback: Predicate, leaveNodeCallback: Callback): void {
    let node = rootNode.firstChild;
    while (node && node !== rootNode) {
        const shouldDescend = enterNodeCallback(node);
        if (shouldDescend && node.firstChild) {
            node = node.firstChild;
        } else if (node.nextSibling) {
            node = node.nextSibling;
        } else {
            while (node && !node.nextSibling && node !== rootNode) {
                node = node.parentElement;
                if (node && node !== rootNode) {
                    leaveNodeCallback(node);
                }
            }
            if (node && node !== rootNode) {
                node = node.nextSibling;
            }
        }
    }
}

export function getCaretOffsetAndText(
    editor: HTMLDivElement,
    sel: Selection,
): {
    caret: DocumentOffset;
    text: string;
} {
    const { offset, text } = getSelectionOffsetAndText(editor, sel.focusNode, sel.focusOffset);
    return { caret: offset, text };
}

function tryReduceSelectionToTextNode(
    selectionNode: Node | null,
    selectionOffset: number,
): {
    node: Node | null;
    characterOffset: number;
} {
    // if selectionNode is an element, the selected location comes after the selectionOffset-th child node,
    // which can point past any childNode, in which case, the end of selectionNode is selected.
    // we try to simplify this to point at a text node with the offset being
    // a character offset within the text node
    // Also see https://developer.mozilla.org/en-US/docs/Web/API/Selection
    while (selectionNode && selectionNode.nodeType === Node.ELEMENT_NODE) {
        const childNodeCount = selectionNode.childNodes.length;
        if (childNodeCount) {
            if (selectionOffset >= childNodeCount) {
                selectionNode = selectionNode.lastChild;
                if (selectionNode?.nodeType === Node.TEXT_NODE) {
                    selectionOffset = selectionNode.textContent?.length || 0;
                } else {
                    // this will select the last child node in the next iteration
                    selectionOffset = Number.MAX_SAFE_INTEGER;
                }
            } else {
                selectionNode = selectionNode.childNodes[selectionOffset];
                // this will select the first child node in the next iteration
                selectionOffset = 0;
            }
        } else {
            // here node won't be a text node,
            // but characterOffset should be 0,
            // this happens under some circumstances
            // when the editor is empty.
            // In this case characterOffset=0 is the right thing to do
            break;
        }
    }
    return {
        node: selectionNode,
        characterOffset: selectionOffset,
    };
}

function getSelectionOffsetAndText(
    editor: HTMLDivElement,
    selectionNode: Node | null,
    selectionOffset: number,
): {
    offset: DocumentOffset;
    text: string;
} {
    const { node, characterOffset } = tryReduceSelectionToTextNode(selectionNode, selectionOffset);
    const { text, offsetToNode } = getTextAndOffsetToNode(editor, node);
    const offset = getCaret(node, offsetToNode, characterOffset);
    return { offset, text };
}

// gets the caret position details, ignoring and adjusting to
// the ZWS if you're typing in a caret node
function getCaret(node: Node | null, offsetToNode: number, offsetWithinNode: number): DocumentOffset {
    // if no node is selected, return an offset at the start
    if (!node) {
        return new DocumentOffset(0, false);
    }
    let atNodeEnd = offsetWithinNode === node.textContent?.length;
    if (node.nodeType === Node.TEXT_NODE && isCaretNode(node.parentElement)) {
        const nodeValue = node.nodeValue || "";
        const zwsIdx = nodeValue.indexOf(CARET_NODE_CHAR);
        if (zwsIdx !== -1 && zwsIdx < offsetWithinNode) {
            offsetWithinNode -= 1;
        }
        // if typing in a caret node, you're either typing before or after the ZWS.
        // In both cases, you should be considered at node end because the ZWS is
        // not included in the text here, and once the model is updated and rerendered,
        // that caret node will be removed.
        atNodeEnd = true;
    }
    return new DocumentOffset(offsetToNode + offsetWithinNode, atNodeEnd);
}

// gets the text of the editor as a string,
// and the offset in characters where the selectionNode starts in that string
// all ZWS from caret nodes are filtered out
function getTextAndOffsetToNode(
    editor: HTMLDivElement,
    selectionNode: Node | null,
): { offsetToNode: number; text: string } {
    let offsetToNode = 0;
    let foundNode = false;
    let text = "";

    function enterNodeCallback(node: Node): boolean {
        if (!foundNode) {
            if (node === selectionNode) {
                foundNode = true;
            }
        }
        // usually newlines are entered as new DIV elements,
        // but for example while pasting in some browsers, they are still
        // converted to BRs, so also take these into account when they
        // are not the last element in the DIV.
        if (node instanceof HTMLElement && node.tagName === "BR" && node.nextSibling) {
            if (!foundNode) {
                offsetToNode += 1;
            }
            text += "\n";
        }
        const nodeText = node.nodeType === Node.TEXT_NODE && getTextNodeValue(node);
        if (nodeText) {
            if (!foundNode) {
                offsetToNode += nodeText.length;
            }
            text += nodeText;
        }
        return true;
    }

    function leaveNodeCallback(node: Node): void {
        // if this is not the last DIV (which are only used as line containers atm)
        // we don't just check if there is a nextSibling because sometimes the caret ends up
        // after the last DIV and it creates a newline if you type then,
        // whereas you just want it to be appended to the current line
        if (
            node instanceof HTMLElement &&
            node.tagName === "DIV" &&
            (<HTMLElement>node.nextSibling)?.tagName === "DIV"
        ) {
            text += "\n";
            if (!foundNode) {
                offsetToNode += 1;
            }
        }
    }

    walkDOMDepthFirst(editor, enterNodeCallback, leaveNodeCallback);

    return { text, offsetToNode };
}

// get text value of text node, ignoring ZWS if it's a caret node
function getTextNodeValue(node: Node): string {
    const nodeText = node.nodeValue;
    if (!nodeText) return "";

    // filter out ZWS for caret nodes
    if (isCaretNode(node.parentElement)) {
        // typed in the caret node, so there is now something more in it than the ZWS
        // so filter out the ZWS, and take the typed text into account
        if (nodeText.length !== 1) {
            return nodeText.replace(CARET_NODE_CHAR, "");
        } else {
            // only contains ZWS, which is ignored, so return empty string
            return "";
        }
    }

    return nodeText;
}

export function getRangeForSelection(editor: HTMLDivElement, model: EditorModel, selection: Selection): Range {
    const focusOffset = getSelectionOffsetAndText(editor, selection.focusNode, selection.focusOffset).offset;
    const anchorOffset = getSelectionOffsetAndText(editor, selection.anchorNode, selection.anchorOffset).offset;
    const focusPosition = focusOffset.asPosition(model);
    const anchorPosition = anchorOffset.asPosition(model);
    return model.startRange(focusPosition, anchorPosition);
}
